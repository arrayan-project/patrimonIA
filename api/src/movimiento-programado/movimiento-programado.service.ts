import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type elemento_patrimonial as ElementoRow,
  type movimiento_programado as MovimientoRow,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ElementoService } from '../elemento/elemento.service.js';
import { derivarValorPendiente } from '../common/deuda.js';
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
import { errorConCodigo } from '../common/errores.js';

/**
 * Movimiento Programado (agregado propio): planificación, NO un hecho económico
 * hasta materializarse (DDD Sección S). Vive fuera del árbol de Evento Financiero
 * hasta el momento exacto de materializar.
 *
 * Tipo (§B5): INGRESO (→ destino), GASTO (← origen), TRANSFERENCIA (origen →
 * destino). Autorización: hereda de los elementos referidos — el actor debe ser
 * propietario de cada uno (GAPS.md G2, DDD §S: sin columnas de visibilidad propias).
 */
@Injectable()
export class MovimientoProgramadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly elementos: ElementoService,
  ) {}

  /** AS #13 — CrearMovimientoProgramado. Sin validación de patrimonio. estado = PENDIENTE. */
  async crear(
    actorId: string,
    dto: CrearMovimientoProgramadoDto,
  ): Promise<MovimientoProgramadoDTO> {
    const moneda = dto.moneda.toUpperCase();
    const { origenId, destinoId } = this.#slots(dto.tipo, dto.elementoOrigenId, dto.elementoDestinoId);

    if (origenId) await this.#exigirElementoCompatible(origenId, actorId, moneda, 'origen');
    if (destinoId) await this.#exigirElementoCompatible(destinoId, actorId, moneda, 'destino', dto.tipo);

    const creado = await this.prisma.$transaction(async (tx) => {
      const m = await tx.movimiento_programado.create({
        data: {
          tipo: dto.tipo,
          monto_planificado: new Prisma.Decimal(dto.montoPlanificado),
          moneda,
          fecha_programada: this.#fecha(dto.fechaProgramada),
          elemento_origen_id: origenId,
          elemento_destino_id: destinoId,
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
          tipo: dto.tipo,
          monto_planificado: dto.montoPlanificado,
          moneda,
          fecha_programada: dto.fechaProgramada.slice(0, 10),
          elemento_origen_id: origenId,
          elemento_destino_id: destinoId,
        },
        entidadRelacionadaTipo: 'ELEMENTO_PATRIMONIAL',
        entidadRelacionadaId: destinoId ?? origenId ?? undefined,
      });
      return m;
    });

    return toMovimientoProgramadoDTO(creado);
  }

  /** AS #14 — ActualizarMovimientoProgramado. Solo en estado PENDIENTE. El tipo no cambia. */
  async actualizar(
    actorId: string,
    dto: ActualizarMovimientoProgramadoDto,
  ): Promise<MovimientoProgramadoDTO> {
    const m = await this.#cargar(dto.movimientoId, actorId);
    if (m.estado !== 'PENDIENTE') {
      throw new ConflictException(`El movimiento está ${m.estado.toLowerCase()}, no se puede editar`);
    }

    const data: Prisma.movimiento_programadoUncheckedUpdateInput = {};
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
    const usaOrigen = m.tipo === 'GASTO' || m.tipo === 'TRANSFERENCIA';
    const usaDestino = m.tipo === 'INGRESO' || m.tipo === 'TRANSFERENCIA';
    if (dto.elementoOrigenId !== undefined && usaOrigen && dto.elementoOrigenId !== m.elemento_origen_id) {
      await this.#exigirElementoCompatible(dto.elementoOrigenId, actorId, m.moneda, 'origen');
      data.elemento_origen_id = dto.elementoOrigenId;
      anterior.elemento_origen_id = m.elemento_origen_id;
      posterior.elemento_origen_id = dto.elementoOrigenId;
    }
    if (dto.elementoDestinoId !== undefined && usaDestino && dto.elementoDestinoId !== m.elemento_destino_id) {
      await this.#exigirElementoCompatible(dto.elementoDestinoId, actorId, m.moneda, 'destino', m.tipo);
      data.elemento_destino_id = dto.elementoDestinoId;
      anterior.elemento_destino_id = m.elemento_destino_id;
      posterior.elemento_destino_id = dto.elementoDestinoId;
    }
    if (dto.observaciones !== undefined && dto.observaciones !== m.observaciones) {
      data.observaciones = dto.observaciones;
      anterior.observaciones = m.observaciones;
      posterior.observaciones = dto.observaciones;
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');
    if (m.tipo === 'TRANSFERENCIA') {
      const origen = data.elemento_origen_id ?? m.elemento_origen_id;
      const destino = data.elemento_destino_id ?? m.elemento_destino_id;
      if (origen === destino) throw errorConCodigo(BadRequestException, 'ORIGEN_IGUAL_DESTINO', 'El origen y el destino no pueden ser el mismo');
    }

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
   * Financiero (del mismo tipo) con los datos confirmados/ajustados. Una única
   * entrada de auditoría bajo este comando.
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
    if (m.fecha_programada.getTime() > this.#hoy().getTime()) {
      throw new BadRequestException('El movimiento aún no alcanza su fecha programada');
    }
    const monto = new Prisma.Decimal(dto.montoEfectivo ?? Number(m.monto_planificado));

    // Plan de impactos según el tipo.
    const cargarActivo = async (id: string): Promise<ElementoRow> => {
      const el = await this.prisma.elemento_patrimonial.findUniqueOrThrow({ where: { id } });
      if (el.estado !== 'ACTIVO') throw new BadRequestException(`El elemento "${el.nombre}" no está activo`);
      return el;
    };
    const plan: { elemento: ElementoRow; delta: Prisma.Decimal }[] = [];
    if (m.elemento_origen_id) {
      plan.push({ elemento: await cargarActivo(m.elemento_origen_id), delta: monto.negated() });
    }
    if (m.elemento_destino_id) {
      const destino = await cargarActivo(m.elemento_destino_id);
      // D-5: el dueño de la cuenta de destino pudo bajar su nivel (D-2) desde que se programó.
      if (!(await this.elementos.puedeRecibirTransferencia(destino, actorId))) {
        throw errorConCodigo(ForbiddenException, 'DESTINO_NO_PERMITIDO', 'No puedes mover fondos a ese elemento destino');
      }
      plan.push({ elemento: destino, delta: monto });
    }

    const { evento } = await this.prisma.$transaction(async (tx) => {
      const evento = await tx.evento_financiero.create({
        data: {
          tipo: m.tipo,
          monto,
          moneda: m.moneda,
          fecha: fechaEfectiva,
          anulado: false,
          movimiento_programado_origen_id: m.id,
        },
      });
      for (const { elemento, delta } of plan) {
        await tx.impacto_patrimonial.create({
          data: {
            elemento_id: elemento.id,
            monto: delta,
            origen_tipo: 'EVENTO_FINANCIERO',
            origen_id: evento.id,
            fecha: fechaEfectiva,
          },
        });
        await tx.elemento_patrimonial.update({
          where: { id: elemento.id },
          data: { valor_vigente: new Prisma.Decimal(elemento.valor_vigente).plus(delta) },
        });
        await derivarValorPendiente(tx, elemento.id);
      }
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
          tipo: m.tipo,
          monto: monto.toNumber(),
          moneda: m.moneda,
          fecha: fechaEfectiva.toISOString().slice(0, 10),
          elemento_origen_id: m.elemento_origen_id,
          elemento_destino_id: m.elemento_destino_id,
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
    const ids = propios.map((p) => p.elemento_id);
    const movimientos = await this.prisma.movimiento_programado.findMany({
      where: {
        // El lado propio (#ladoPropio): la cuenta que recibe una transferencia
        // programada por otro miembro (D-5) no la ve como suya.
        OR: [{ elemento_origen_id: { in: ids } }, { tipo: 'INGRESO', elemento_destino_id: { in: ids } }],
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

  /** Devuelve los ids origen/destino que corresponden al tipo, rechazando los que no. */
  #slots(
    tipo: string,
    origenId?: string,
    destinoId?: string,
  ): { origenId: string | null; destinoId: string | null } {
    if (tipo === 'INGRESO') {
      if (!destinoId) throw errorConCodigo(BadRequestException, 'FALTA_CUENTA', 'INGRESO requiere elementoDestinoId');
      if (origenId) throw new BadRequestException('INGRESO no lleva elementoOrigenId');
      return { origenId: null, destinoId };
    }
    if (tipo === 'GASTO') {
      if (!origenId) throw errorConCodigo(BadRequestException, 'FALTA_CUENTA', 'GASTO requiere elementoOrigenId');
      if (destinoId) throw new BadRequestException('GASTO no lleva elementoDestinoId');
      return { origenId, destinoId: null };
    }
    // TRANSFERENCIA
    if (!origenId || !destinoId) {
      throw errorConCodigo(BadRequestException, 'FALTA_CUENTA', 'TRANSFERENCIA requiere elementoOrigenId y elementoDestinoId');
    }
    if (origenId === destinoId) {
      throw errorConCodigo(BadRequestException, 'ORIGEN_IGUAL_DESTINO', 'El origen y el destino no pueden ser el mismo');
    }
    return { origenId, destinoId };
  }

  async #cargar(movimientoId: string, actorId: string): Promise<MovimientoRow> {
    const m = await this.prisma.movimiento_programado.findUnique({ where: { id: movimientoId } });
    if (!m) throw new NotFoundException('Movimiento programado no encontrado');
    const propio = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: this.#ladoPropio(m), usuario_id: actorId },
    });
    if (!propio) {
      throw new ForbiddenException('No eres propietario de los elementos del movimiento');
    }
    return m;
  }

  /**
   * El elemento que el actor tiene que tener para operar el movimiento: el
   * origen si lo hay (GASTO, TRANSFERENCIA), si no el destino (INGRESO). El
   * destino de una transferencia puede ser de otro miembro (D-5).
   */
  #ladoPropio(m: MovimientoRow): string {
    return (m.elemento_origen_id ?? m.elemento_destino_id)!;
  }

  /** Propio; o, como destino de una TRANSFERENCIA, de un miembro que deja transferirle (D-5, D-2). */
  async #exigirElementoCompatible(
    elementoId: string,
    actorId: string,
    moneda: string,
    rol: 'origen' | 'destino',
    tipo?: string,
  ): Promise<ElementoRow> {
    const el = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!el) throw new NotFoundException(`Elemento ${rol} no encontrado`);
    if (rol === 'destino' && tipo === 'TRANSFERENCIA') {
      if (!(await this.elementos.puedeRecibirTransferencia(el, actorId))) {
        throw errorConCodigo(ForbiddenException, 'DESTINO_NO_PERMITIDO', 'No puedes mover fondos a ese elemento destino');
      }
    } else {
      const prop = await this.prisma.elemento_propietario.findFirst({
        where: { elemento_id: elementoId, usuario_id: actorId },
      });
      if (!prop) throw new ForbiddenException(`No eres propietario del elemento ${rol}`);
    }
    if (el.moneda !== moneda) {
      throw new BadRequestException(
        `La moneda (${moneda}) no coincide con la del elemento ${rol} (${el.moneda})`,
      );
    }
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
