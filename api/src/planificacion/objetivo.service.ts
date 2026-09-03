import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type objetivo_financiero as ObjetivoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ProgresoService } from './progreso.service.js';
import { toObjetivoDTO, type ObjetivoFinancieroDTO } from './planificacion.dto.js';
import type {
  ActualizarObjetivoDto,
  CambiarEstadoObjetivoDto,
  CrearObjetivoDto,
  EliminarObjetivoDto,
} from './dto/objetivo.dto.js';

@Injectable()
export class ObjetivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly progreso: ProgresoService,
  ) {}

  /** AS #30 — CrearObjetivoFinanciero. Estado inicial EN_PROGRESO. */
  async crear(actorId: string, dto: CrearObjetivoDto): Promise<ObjetivoFinancieroDTO> {
    const objetivo = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.objetivo_financiero.create({
        data: {
          nombre: dto.nombre,
          monto_objetivo: new Prisma.Decimal(dto.montoObjetivo),
          fecha_objetivo: dto.fechaObjetivo ? new Date(dto.fechaObjetivo) : null,
          estado: 'EN_PROGRESO',
          usuario_id: actorId,
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearObjetivoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: creado.id,
        valorPosterior: {
          nombre: creado.nombre,
          monto_objetivo: dto.montoObjetivo,
          fecha_objetivo: dto.fechaObjetivo ?? null,
        },
      });
      return creado;
    });
    return toObjetivoDTO(objetivo, 0);
  }

  /** AS #31 — ActualizarDatosObjetivoFinanciero. */
  async actualizar(actorId: string, dto: ActualizarObjetivoDto): Promise<ObjetivoFinancieroDTO> {
    const o = await this.#cargar(dto.objetivoId, actorId);
    const data: Prisma.objetivo_financieroUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};
    if (dto.nombre !== undefined && dto.nombre !== o.nombre) {
      data.nombre = dto.nombre;
      anterior.nombre = o.nombre;
      posterior.nombre = dto.nombre;
    }
    if (dto.montoObjetivo !== undefined && dto.montoObjetivo !== Number(o.monto_objetivo)) {
      data.monto_objetivo = new Prisma.Decimal(dto.montoObjetivo);
      anterior.monto_objetivo = Number(o.monto_objetivo);
      posterior.monto_objetivo = dto.montoObjetivo;
    }
    if (dto.fechaObjetivo !== undefined) {
      data.fecha_objetivo = new Date(dto.fechaObjetivo);
      posterior.fecha_objetivo = dto.fechaObjetivo;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');
    await this.prisma.$transaction(async (tx) => {
      await tx.objetivo_financiero.update({ where: { id: o.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarDatosObjetivoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: o.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
    });
    return this.obtener(o.id, actorId);
  }

  /** AS #32 — CambiarEstadoObjetivoFinanciero (transición manual universal). */
  async cambiarEstado(
    actorId: string,
    dto: CambiarEstadoObjetivoDto,
  ): Promise<ObjetivoFinancieroDTO> {
    const o = await this.#cargar(dto.objetivoId, actorId);
    if (o.estado === dto.estado) throw new BadRequestException('El objetivo ya tiene ese estado');
    await this.prisma.$transaction(async (tx) => {
      await tx.objetivo_financiero.update({ where: { id: o.id }, data: { estado: dto.estado } });
      await this.auditoria.registrar(tx, {
        comando: 'CambiarEstadoObjetivoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: o.id,
        valorAnterior: { estado: o.estado },
        valorPosterior: { estado: dto.estado, origen: 'manual' },
      });
    });
    return this.obtener(o.id, actorId);
  }

  /** AS #33 — EliminarObjetivoFinanciero. Desasocia asignaciones sin cascada. */
  async eliminar(actorId: string, dto: EliminarObjetivoDto): Promise<{ ok: true; asignacionesDesasociadas: string[] }> {
    const o = await this.#cargar(dto.objetivoId, actorId);
    const asignaciones = await this.prisma.asignacion.findMany({
      where: { objetivo_financiero_id: o.id },
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.asignacion.updateMany({
        where: { objetivo_financiero_id: o.id },
        data: { objetivo_financiero_id: null },
      });
      await tx.objetivo_financiero.delete({ where: { id: o.id } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarObjetivoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: o.id,
        motivo: dto.motivo,
        valorAnterior: {
          nombre: o.nombre,
          asignaciones_desasociadas: asignaciones.map((a) => a.id),
        },
      });
    });
    return { ok: true, asignacionesDesasociadas: asignaciones.map((a) => a.id) };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtener(objetivoId: string, actorId: string): Promise<ObjetivoFinancieroDTO> {
    const o = await this.#cargar(objetivoId, actorId);
    return toObjetivoDTO(o, await this.progreso.progresoDeObjetivo(o.id));
  }

  async listar(actorId: string, estado?: string): Promise<ObjetivoFinancieroDTO[]> {
    const objetivos = await this.prisma.objetivo_financiero.findMany({
      where: { usuario_id: actorId, ...(estado ? { estado } : {}) },
      orderBy: { created_at: 'desc' },
    });
    return Promise.all(
      objetivos.map(async (o) =>
        toObjetivoDTO(o, await this.progreso.progresoDeObjetivo(o.id)),
      ),
    );
  }

  async #cargar(objetivoId: string, actorId: string): Promise<ObjetivoRow> {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!o) throw new NotFoundException('Objetivo no encontrado');
    if (o.usuario_id !== actorId) throw new ForbiddenException('El objetivo no es tuyo');
    return o;
  }
}
