import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type movimiento_programado as MovimientoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  toMovimientoProgramadoDTO,
  type MovimientoProgramadoDTO,
} from './movimiento-programado.dto.js';
import type {
  ActualizarMovimientoProgramadoDto,
  CancelarMovimientoProgramadoDto,
  CrearMovimientoProgramadoDto,
  MaterializarMovimientoProgramadoDto,
} from './dto/movimiento-programado.dto.js';

/**
 * Movimiento Programado (agregado propio): planificación, NO un hecho económico
 * hasta materializarse (DDD Sección S). Vive fuera del árbol de Evento Financiero
 * hasta el momento exacto de materializar.
 *
 * Autorización: hereda del elemento destino — el actor debe ser propietario de
 * `elemento_destino_id` (GAPS.md G2).
 */
@Injectable()
export class MovimientoProgramadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** AS #13 — CrearMovimientoProgramado. Sin validación de patrimonio. estado = PENDIENTE. */
  async crear(
    actorId: string,
    dto: CrearMovimientoProgramadoDto,
  ): Promise<MovimientoProgramadoDTO> {
    const moneda = dto.moneda.toUpperCase();
    const destino = await this.#exigirElementoPropio(dto.elementoDestinoId, actorId);
    if (destino.moneda !== moneda) {
      throw new BadRequestException(
        `La moneda (${moneda}) no coincide con la del elemento destino (${destino.moneda})`,
      );
    }

    const creado = await this.prisma.$transaction(async (tx) => {
      const m = await tx.movimiento_programado.create({
        data: {
          monto_planificado: new Prisma.Decimal(dto.montoPlanificado),
          moneda,
          fecha_programada: this.#fecha(dto.fechaProgramada),
          elemento_destino_id: dto.elementoDestinoId,
          observaciones: dto.observaciones ?? null,
          estado: 'PENDIENTE',
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearMovimientoProgramado',
        usuarioId: actorId,
        entidadTipo: 'MOVIMIENTO_PROGRAMADO',
        entidadId: m.id,
        valorPosterior: {
          monto_planificado: dto.montoPlanificado,
          moneda,
          fecha_programada: dto.fechaProgramada.slice(0, 10),
          elemento_destino_id: dto.elementoDestinoId,
        },
        entidadRelacionadaTipo: 'ELEMENTO_PATRIMONIAL',
        entidadRelacionadaId: dto.elementoDestinoId,
      });
      return m;
    });

    return toMovimientoProgramadoDTO(creado);
  }

  /** AS #14 — ActualizarMovimientoProgramado. Solo en estado PENDIENTE. */
  async actualizar(
    actorId: string,
    dto: ActualizarMovimientoProgramadoDto,
  ): Promise<MovimientoProgramadoDTO> {
    const m = await this.#cargar(dto.movimientoId, actorId);
    if (m.estado !== 'PENDIENTE') {
      throw new ConflictException(`El movimiento está ${m.estado.toLowerCase()}, no se puede editar`);
    }

    const data: Prisma.movimiento_programadoUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};

    if (dto.montoPlanificado !== undefined && dto.montoPlanificado !== Number(m.monto_planificado)) {
      data.monto_planificado = new Prisma.Decimal(dto.montoPlanificado);
      anterior.monto_planificado = Number(m.monto_planificado);
      posterior.monto_planificado = dto.montoPlanificado;
    }
    if (dto.fechaProgramada !== undefined) {
      const f = this.#fecha(dto.fechaProgramada);
      if (f.getTime() !== m.fecha_programada.getTime()) {
        data.fecha_programada = f;
        anterior.fecha_programada = m.fecha_programada.toISOString().slice(0, 10);
        posterior.fecha_programada = dto.fechaProgramada.slice(0, 10);
      }
    }
    if (dto.elementoDestinoId !== undefined && dto.elementoDestinoId !== m.elemento_destino_id) {
      const destino = await this.#exigirElementoPropio(dto.elementoDestinoId, actorId);
      if (destino.moneda !== m.moneda) {
        throw new BadRequestException('El nuevo elemento destino tiene otra moneda');
      }
      data.elemento_patrimonial = { connect: { id: dto.elementoDestinoId } };
      anterior.elemento_destino_id = m.elemento_destino_id;
      posterior.elemento_destino_id = dto.elementoDestinoId;
    }
    if (dto.observaciones !== undefined && dto.observaciones !== m.observaciones) {
      data.observaciones = dto.observaciones;
      anterior.observaciones = m.observaciones;
      posterior.observaciones = dto.observaciones;
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.movimiento_programado.update({ where: { id: m.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarMovimientoProgramado',
        usuarioId: actorId,
        entidadTipo: 'MOVIMIENTO_PROGRAMADO',
        entidadId: m.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
      return fila;
    });

    return toMovimientoProgramadoDTO(actualizado);
  }

  /**
   * AS #15 — MaterializarMovimientoProgramado. Dispara la creación de un Evento
   * Financiero INGRESO hacia el elemento destino (GAPS.md G2) con los datos
   * confirmados/ajustados. Una única entrada de auditoría bajo este comando.
   */
  async materializar(
    actorId: string,
    dto: MaterializarMovimientoProgramadoDto,
  ): Promise<MovimientoProgramadoDTO> {
    const m = await this.#cargar(dto.movimientoId, actorId);
    if (m.estado !== 'PENDIENTE') {
      throw new ConflictException(`El movimiento ya está ${m.estado.toLowerCase()}`);
    }
    const fechaEfectiva = dto.fechaEfectiva ? this.#fecha(dto.fechaEfectiva) : this.#hoy();
    const hoy = this.#hoy();
    if (m.fecha_programada.getTime() > hoy.getTime()) {
      throw new BadRequestException('El movimiento aún no alcanza su fecha programada');
    }
    const destino = await this.prisma.elemento_patrimonial.findUniqueOrThrow({
      where: { id: m.elemento_destino_id },
    });
    if (destino.estado !== 'ACTIVO') {
      throw new BadRequestException('El elemento destino no está activo');
    }
    const monto = new Prisma.Decimal(dto.montoEfectivo ?? Number(m.monto_planificado));

    const { evento } = await this.prisma.$transaction(async (tx) => {
      const evento = await tx.evento_financiero.create({
        data: {
          tipo: 'INGRESO',
          monto,
          moneda: m.moneda,
          fecha: fechaEfectiva,
          anulado: false,
          movimiento_programado_origen_id: m.id,
        },
      });
      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: destino.id,
          monto,
          origen_tipo: 'EVENTO_FINANCIERO',
          origen_id: evento.id,
          fecha: fechaEfectiva,
        },
      });
      await tx.elemento_patrimonial.update({
        where: { id: destino.id },
        data: { valor_vigente: new Prisma.Decimal(destino.valor_vigente).plus(monto) },
      });
      await tx.movimiento_programado.update({
        where: { id: m.id },
        data: { estado: 'MATERIALIZADO' },
      });
      await this.auditoria.registrar(tx, {
        comando: 'MaterializarMovimientoProgramado',
        usuarioId: actorId,
        entidadTipo: 'MOVIMIENTO_PROGRAMADO',
        entidadId: m.id,
        valorAnterior: { estado: 'PENDIENTE' },
        valorPosterior: {
          estado: 'MATERIALIZADO',
          evento_financiero_id: evento.id,
          tipo: 'INGRESO',
          monto: monto.toNumber(),
          moneda: m.moneda,
          fecha: fechaEfectiva.toISOString().slice(0, 10),
          elemento_destino_id: destino.id,
        },
        entidadRelacionadaTipo: 'EVENTO_FINANCIERO',
        entidadRelacionadaId: evento.id,
      });
      return { evento };
    });

    const actualizado = await this.prisma.movimiento_programado.findUniqueOrThrow({
      where: { id: m.id },
    });
    return toMovimientoProgramadoDTO(actualizado, evento.id);
  }

  /** AS #16 — CancelarMovimientoProgramado. Solo PENDIENTE. Sin efecto sobre saldos. */
  async cancelar(
    actorId: string,
    dto: CancelarMovimientoProgramadoDto,
  ): Promise<MovimientoProgramadoDTO> {
    const m = await this.#cargar(dto.movimientoId, actorId);
    if (m.estado !== 'PENDIENTE') {
      throw new ConflictException(`El movimiento ya está ${m.estado.toLowerCase()}`);
    }
    const cancelado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.movimiento_programado.update({
        where: { id: m.id },
        data: { estado: 'CANCELADO' },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CancelarMovimientoProgramado',
        usuarioId: actorId,
        entidadTipo: 'MOVIMIENTO_PROGRAMADO',
        entidadId: m.id,
        motivo: dto.motivo,
        valorAnterior: { estado: 'PENDIENTE' },
        valorPosterior: { estado: 'CANCELADO' },
      });
      return fila;
    });
    return toMovimientoProgramadoDTO(cancelado);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtener(movimientoId: string, actorId: string): Promise<MovimientoProgramadoDTO> {
    const m = await this.#cargar(movimientoId, actorId);
    return toMovimientoProgramadoDTO(m, await this.#eventoOrigen(m.id));
  }

  async listar(actorId: string, estado?: string): Promise<MovimientoProgramadoDTO[]> {
    const propios = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: actorId },
      select: { elemento_id: true },
    });
    const movimientos = await this.prisma.movimiento_programado.findMany({
      where: {
        elemento_destino_id: { in: propios.map((p) => p.elemento_id) },
        ...(estado ? { estado } : {}),
      },
      orderBy: { fecha_programada: 'asc' },
    });
    return Promise.all(
      movimientos.map(async (m) =>
        toMovimientoProgramadoDTO(m, await this.#eventoOrigen(m.id)),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #cargar(movimientoId: string, actorId: string): Promise<MovimientoRow> {
    const m = await this.prisma.movimiento_programado.findUnique({ where: { id: movimientoId } });
    if (!m) throw new NotFoundException('Movimiento programado no encontrado');
    await this.#exigirElementoPropio(m.elemento_destino_id, actorId);
    return m;
  }

  async #exigirElementoPropio(elementoId: string, actorId: string) {
    const el = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!el) throw new NotFoundException('Elemento destino no encontrado');
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario del elemento destino');
    return el;
  }

  async #eventoOrigen(movimientoId: string): Promise<string | null> {
    const e = await this.prisma.evento_financiero.findFirst({
      where: { movimiento_programado_origen_id: movimientoId },
      select: { id: true },
    });
    return e?.id ?? null;
  }

  #fecha(iso: string): Date {
    return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  }

  #hoy(): Date {
    return this.#fecha(new Date().toISOString());
  }
}
