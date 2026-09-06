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
  CompartirObjetivoConHogarDto,
  CrearObjetivoDto,
  DefinirDesignadosObjetivoDto,
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
    if (dto.hogarId) await this.#exigirMiembro(dto.hogarId, actorId);

    const objetivo = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.objetivo_financiero.create({
        data: {
          nombre: dto.nombre,
          monto_objetivo: new Prisma.Decimal(dto.montoObjetivo),
          fecha_objetivo: dto.fechaObjetivo ? new Date(dto.fechaObjetivo) : null,
          estado: 'EN_PROGRESO',
          usuario_id: actorId,
          hogar_id: dto.hogarId ?? null,
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
          ...(dto.hogarId ? { hogar_id: dto.hogarId } : {}),
        },
      });
      return creado;
    });
    return toObjetivoDTO(objetivo, 0, { actorId, designados: [] });
  }

  /** AS #31 — ActualizarDatosObjetivoFinanciero. */
  async actualizar(actorId: string, dto: ActualizarObjetivoDto): Promise<ObjetivoFinancieroDTO> {
    const o = await this.#cargarModificable(dto.objetivoId, actorId);
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
    const o = await this.#cargarModificable(dto.objetivoId, actorId);
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
  async eliminar(
    actorId: string,
    dto: EliminarObjetivoDto,
  ): Promise<{ ok: true; asignacionesDesasociadas: string[] }> {
    const o = await this.#cargarModificable(dto.objetivoId, actorId);
    if (o.usuario_id !== actorId) {
      throw new ForbiddenException('Solo el dueño puede eliminar el objetivo');
    }
    const asignaciones = await this.prisma.asignacion.findMany({
      where: { objetivo_financiero_id: o.id },
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.asignacion.updateMany({
        where: { objetivo_financiero_id: o.id },
        data: { objetivo_financiero_id: null },
      });
      await tx.objetivo_designado.deleteMany({ where: { objetivo_id: o.id } });
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

  /** P9 — CompartirObjetivoConHogar (solo el dueño). hogarId null → deja de compartir. */
  async compartirConHogar(
    actorId: string,
    dto: CompartirObjetivoConHogarDto,
  ): Promise<ObjetivoFinancieroDTO> {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: dto.objetivoId } });
    if (!o) throw new NotFoundException('Objetivo no encontrado');
    if (o.usuario_id !== actorId) {
      throw new ForbiddenException('Solo el dueño puede compartir el objetivo');
    }
    const nuevoHogar = dto.hogarId ?? null;
    if (nuevoHogar === o.hogar_id) throw new BadRequestException('Sin cambios');
    if (nuevoHogar) await this.#exigirMiembro(nuevoHogar, actorId);

    await this.prisma.$transaction(async (tx) => {
      await tx.objetivo_financiero.update({
        where: { id: o.id },
        data: { hogar_id: nuevoHogar },
      });
      if (!nuevoHogar) {
        await tx.objetivo_designado.deleteMany({ where: { objetivo_id: o.id } });
      }
      await this.auditoria.registrar(tx, {
        comando: 'CompartirObjetivoConHogar',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: o.id,
        valorAnterior: { hogar_id: o.hogar_id },
        valorPosterior: { hogar_id: nuevoHogar },
        ...(nuevoHogar ? { entidadRelacionadaTipo: 'HOGAR', entidadRelacionadaId: nuevoHogar } : {}),
      });
    });
    return this.obtener(o.id, actorId);
  }

  /** P9 — DefinirDesignadosObjetivo (el ADMINISTRADOR del hogar, o el dueño). */
  async definirDesignados(
    actorId: string,
    dto: DefinirDesignadosObjetivoDto,
  ): Promise<ObjetivoFinancieroDTO> {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: dto.objetivoId } });
    if (!o) throw new NotFoundException('Objetivo no encontrado');
    if (!o.hogar_id) {
      throw new BadRequestException('El objetivo no está compartido con un hogar');
    }
    const esDueno = o.usuario_id === actorId;
    if (!esDueno && !(await this.#esAdmin(o.hogar_id, actorId))) {
      throw new ForbiddenException('Solo el administrador del hogar asigna los designados');
    }

    const ids = [...new Set(dto.usuarioIds)];
    if (ids.length > 0) {
      const miembros = await this.prisma.membresia.findMany({
        where: { hogar_id: o.hogar_id, usuario_id: { in: ids }, estado: 'ACTIVA' },
        select: { usuario_id: true },
      });
      if (miembros.length !== ids.length) {
        throw new BadRequestException('Algún designado no es miembro activo del hogar');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const previos = await tx.objetivo_designado.findMany({
        where: { objetivo_id: o.id },
        select: { usuario_id: true },
      });
      await tx.objetivo_designado.deleteMany({ where: { objetivo_id: o.id } });
      if (ids.length > 0) {
        await tx.objetivo_designado.createMany({
          data: ids.map((usuario_id) => ({ objetivo_id: o.id, usuario_id })),
        });
      }
      await this.auditoria.registrar(tx, {
        comando: 'DefinirDesignadosObjetivo',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: o.id,
        valorAnterior: { designados: previos.map((p) => p.usuario_id) },
        valorPosterior: { designados: ids },
      });
    });
    return this.obtener(o.id, actorId);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtener(objetivoId: string, actorId: string): Promise<ObjetivoFinancieroDTO> {
    const o = await this.#cargarVisible(objetivoId, actorId);
    return toObjetivoDTO(o, await this.progreso.progresoDeObjetivo(o.id), {
      actorId,
      designados: await this.#designadosDe(o.id),
    });
  }

  async listar(actorId: string, estado?: string): Promise<ObjetivoFinancieroDTO[]> {
    const hogares = (
      await this.prisma.membresia.findMany({
        where: { usuario_id: actorId, estado: 'ACTIVA' },
        select: { hogar_id: true },
      })
    ).map((m) => m.hogar_id);

    const objetivos = await this.prisma.objetivo_financiero.findMany({
      where: {
        ...(estado ? { estado } : {}),
        OR: [{ usuario_id: actorId }, { hogar_id: { in: hogares } }],
      },
      orderBy: { created_at: 'desc' },
    });
    return Promise.all(
      objetivos.map(async (o) =>
        toObjetivoDTO(o, await this.progreso.progresoDeObjetivo(o.id), {
          actorId,
          designados: await this.#designadosDe(o.id),
        }),
      ),
    );
  }

  // ── Acceso ────────────────────────────────────────────────────────────────

  /** Dueño o miembro activo del hogar con el que se comparte. */
  async #cargarVisible(objetivoId: string, actorId: string): Promise<ObjetivoRow> {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!o) throw new NotFoundException('Objetivo no encontrado');
    if (o.usuario_id === actorId) return o;
    if (o.hogar_id && (await this.#esMiembro(o.hogar_id, actorId))) return o;
    throw new NotFoundException('Objetivo no encontrado');
  }

  /** Dueño o designado (compartido). */
  async #cargarModificable(objetivoId: string, actorId: string): Promise<ObjetivoRow> {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!o) throw new NotFoundException('Objetivo no encontrado');
    if (o.usuario_id === actorId) return o;
    if (o.hogar_id) {
      const d = await this.prisma.objetivo_designado.findUnique({
        where: { objetivo_id_usuario_id: { objetivo_id: o.id, usuario_id: actorId } },
      });
      if (d) return o;
    }
    throw new ForbiddenException('No puedes modificar este objetivo');
  }

  async #designadosDe(objetivoId: string): Promise<string[]> {
    const filas = await this.prisma.objetivo_designado.findMany({
      where: { objetivo_id: objetivoId },
      select: { usuario_id: true },
    });
    return filas.map((f) => f.usuario_id);
  }

  async #esMiembro(hogarId: string, actorId: string): Promise<boolean> {
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
    });
    return m !== null;
  }

  async #esAdmin(hogarId: string, actorId: string): Promise<boolean> {
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA', rol: 'ADMINISTRADOR' },
    });
    return m !== null;
  }

  async #exigirMiembro(hogarId: string, actorId: string): Promise<void> {
    if (!(await this.#esMiembro(hogarId, actorId))) {
      throw new ForbiddenException('No eres miembro activo de ese hogar');
    }
  }
}
