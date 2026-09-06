import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type asignacion as AsignacionRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ProgresoService } from './progreso.service.js';
import { toAsignacionDTO, type AsignacionDTO } from './planificacion.dto.js';
import type {
  ActualizarAsignacionDto,
  CambiarAsociacionDto,
  CrearAsignacionDto,
  EliminarAsignacionDto,
} from './dto/asignacion.dto.js';

@Injectable()
export class AsignacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly progreso: ProgresoService,
  ) {}

  /** AS #23 — CrearAsignacion. No constituye patrimonio. */
  async crear(actorId: string, dto: CrearAsignacionDto): Promise<AsignacionDTO> {
    if (dto.objetivoId) await this.#exigirObjetivoModificable(dto.objetivoId, actorId);

    const asignacion = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.asignacion.create({
        data: {
          nombre: dto.nombre,
          monto_objetivo:
            dto.montoObjetivo === undefined ? null : new Prisma.Decimal(dto.montoObjetivo),
          objetivo_financiero_id: dto.objetivoId ?? null,
          usuario_id: actorId,
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearAsignacion',
        usuarioId: actorId,
        entidadTipo: 'ASIGNACION',
        entidadId: creada.id,
        valorPosterior: {
          nombre: creada.nombre,
          monto_objetivo: dto.montoObjetivo ?? null,
          objetivo_financiero_id: dto.objetivoId ?? null,
        },
      });
      return creada;
    });
    return toAsignacionDTO(asignacion, []);
  }

  /** AS #24 — ActualizarDatosAsignacion. */
  async actualizar(actorId: string, dto: ActualizarAsignacionDto): Promise<AsignacionDTO> {
    const a = await this.#cargar(dto.asignacionId, actorId);
    const data: Prisma.asignacionUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};
    if (dto.nombre !== undefined && dto.nombre !== a.nombre) {
      data.nombre = dto.nombre;
      anterior.nombre = a.nombre;
      posterior.nombre = dto.nombre;
    }
    if (dto.montoObjetivo !== undefined) {
      data.monto_objetivo = new Prisma.Decimal(dto.montoObjetivo);
      anterior.monto_objetivo = a.monto_objetivo === null ? null : Number(a.monto_objetivo);
      posterior.monto_objetivo = dto.montoObjetivo;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');
    await this.prisma.$transaction(async (tx) => {
      await tx.asignacion.update({ where: { id: a.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarDatosAsignacion',
        usuarioId: actorId,
        entidadTipo: 'ASIGNACION',
        entidadId: a.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
    });
    return this.obtener(a.id, actorId);
  }

  /** AS #25 — CambiarAsociacionAObjetivo. Recalcula progreso del anterior y del nuevo. */
  async cambiarAsociacion(actorId: string, dto: CambiarAsociacionDto): Promise<AsignacionDTO> {
    const a = await this.#cargar(dto.asignacionId, actorId);
    const nuevoObjetivoId = dto.objetivoId ?? null;
    if (nuevoObjetivoId === a.objetivo_financiero_id) throw new BadRequestException('Sin cambios');
    if (nuevoObjetivoId) await this.#exigirObjetivoModificable(nuevoObjetivoId, actorId);
    const anteriorObjetivoId = a.objetivo_financiero_id;

    await this.prisma.$transaction(async (tx) => {
      await tx.asignacion.update({
        where: { id: a.id },
        data: { objetivo_financiero_id: nuevoObjetivoId },
      });
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'CambiarAsociacionAObjetivo',
        usuarioId: actorId,
        entidadTipo: 'ASIGNACION',
        entidadId: a.id,
        valorAnterior: { objetivo_financiero_id: anteriorObjetivoId },
        valorPosterior: { objetivo_financiero_id: nuevoObjetivoId },
      });
      if (nuevoObjetivoId) {
        await this.progreso.recalcularYCompletar(tx, nuevoObjetivoId, actorId, entradaId);
      }
    });
    return this.obtener(a.id, actorId);
  }

  /**
   * AS #26 — EliminarAsignacion. Elimina sus reservas en cascada (libera el
   * valor reservado hacia los elementos origen) y recalcula el progreso del
   * objetivo si estaba asociado.
   */
  async eliminar(
    actorId: string,
    dto: EliminarAsignacionDto,
  ): Promise<{ ok: true; reservasLiberadas: string[] }> {
    const a = await this.#cargar(dto.asignacionId, actorId);
    const reservas = await this.prisma.reserva.findMany({ where: { asignacion_id: a.id } });

    await this.prisma.$transaction(async (tx) => {
      await tx.reserva.deleteMany({ where: { asignacion_id: a.id } });
      await tx.asignacion.delete({ where: { id: a.id } });
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'EliminarAsignacion',
        usuarioId: actorId,
        entidadTipo: 'ASIGNACION',
        entidadId: a.id,
        motivo: dto.motivo,
        valorAnterior: {
          nombre: a.nombre,
          reservas_eliminadas: reservas.map((r) => ({
            id: r.id,
            elemento_origen_id: r.elemento_origen_id,
            monto: Number(r.monto),
          })),
        },
      });
      if (a.objetivo_financiero_id) {
        await this.progreso.recalcularYCompletar(tx, a.objetivo_financiero_id, actorId, entradaId);
      }
    });
    return { ok: true, reservasLiberadas: reservas.map((r) => r.id) };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtener(asignacionId: string, actorId: string): Promise<AsignacionDTO> {
    const a = await this.#cargar(asignacionId, actorId);
    const reservas = await this.prisma.reserva.findMany({ where: { asignacion_id: a.id } });
    return toAsignacionDTO(a, reservas, true);
  }

  async listar(actorId: string, objetivoId?: string): Promise<AsignacionDTO[]> {
    // P9 — asignaciones propias + las de objetivos compartidos que el actor ve.
    const hogares = (
      await this.prisma.membresia.findMany({
        where: { usuario_id: actorId, estado: 'ACTIVA' },
        select: { hogar_id: true },
      })
    ).map((m) => m.hogar_id);
    const compartidos = (
      await this.prisma.objetivo_financiero.findMany({
        where: { hogar_id: { in: hogares } },
        select: { id: true },
      })
    ).map((o) => o.id);

    const asignaciones = await this.prisma.asignacion.findMany({
      where: {
        ...(objetivoId ? { objetivo_financiero_id: objetivoId } : {}),
        OR: [{ usuario_id: actorId }, { objetivo_financiero_id: { in: compartidos } }],
      },
      orderBy: { created_at: 'desc' },
    });
    const reservas = await this.prisma.reserva.findMany({
      where: { asignacion_id: { in: asignaciones.map((a) => a.id) } },
    });
    const porAsignacion = new Map<string, typeof reservas>();
    for (const r of reservas) {
      const arr = porAsignacion.get(r.asignacion_id) ?? [];
      arr.push(r);
      porAsignacion.set(r.asignacion_id, arr);
    }
    return asignaciones.map((a) => toAsignacionDTO(a, porAsignacion.get(a.id) ?? []));
  }

  async #cargar(asignacionId: string, actorId: string): Promise<AsignacionRow> {
    const a = await this.prisma.asignacion.findUnique({ where: { id: asignacionId } });
    if (!a) throw new NotFoundException('Asignación no encontrada');
    if (a.usuario_id === actorId) return a;
    // P9 — asignación de un objetivo compartido: la modifican dueño/designados.
    if (a.objetivo_financiero_id && (await this.#puedeModificarObjetivo(a.objetivo_financiero_id, actorId))) {
      return a;
    }
    throw new ForbiddenException('La asignación no es tuya');
  }

  async #exigirObjetivoModificable(objetivoId: string, actorId: string): Promise<void> {
    if (!(await this.#puedeModificarObjetivo(objetivoId, actorId))) {
      throw new NotFoundException('Objetivo no encontrado');
    }
  }

  async #puedeModificarObjetivo(objetivoId: string, actorId: string): Promise<boolean> {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!o) return false;
    if (o.usuario_id === actorId) return true;
    if (!o.hogar_id) return false;
    const d = await this.prisma.objetivo_designado.findUnique({
      where: { objetivo_id_usuario_id: { objetivo_id: objetivoId, usuario_id: actorId } },
    });
    return d !== null;
  }
}
