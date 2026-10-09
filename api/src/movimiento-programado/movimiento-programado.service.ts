import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Prisma,
  type elemento_patrimonial as ElementoRow,
  type movimiento_programado as MovimientoRow,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ElementoService } from '../elemento/elemento.service.js';
import { derivarValorPendiente } from '../common/deuda.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { hoyChile, siguienteFecha, type Periodicidad } from './recurrencia.js';
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

/** El nombre del aviso cuando no hay detalle ni categoría. */
const NOMBRE_POR_TIPO: Record<string, string> = {
  INGRESO: 'Ingreso programado',
  GASTO: 'Gasto programado',
  TRANSFERENCIA: 'Transferencia programada',
};

/** "35.000 CLP", como los textos de la app (igual que en las solicitudes). */
function texto(monto: number | Prisma.Decimal, moneda: string): string {
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(monto))} ${moneda}`;
}

/**
 * Movimiento Programado (agregado propio): planificación, NO un hecho económico
 * hasta materializarse (DDD Sección S). Vive fuera del árbol de Evento Financiero
 * hasta el momento exacto de materializar.
 *
 * Tipo (§B5): INGRESO (→ destino), GASTO (← origen), TRANSFERENCIA (origen →
 * destino). Autorización: hereda de los elementos referidos — el actor debe ser
 * propietario de cada uno (GAPS.md G2, DDD §S: sin columnas de visibilidad propias).
 *
 * Recurrencia (G33, D-6): una fila por ocurrencia; las de una serie comparten
 * `serie_id`. Ninguna se materializa sola: al llegar la fecha se avisa
 * "¿Se pagó?" y la ocurrencia queda PENDIENTE hasta que el usuario responda
 * (#revisarVencidos).
 */
@Injectable()
export class MovimientoProgramadoService implements OnApplicationBootstrap {
  private readonly logger = new Logger('MovimientoProgramado');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly elementos: ElementoService,
    private readonly notificaciones: NotificacionService,
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
    const categoriaId = await this.#validarCategoria(dto.categoriaId, dto.tipo, actorId);
    const fecha = this.#fecha(dto.fechaProgramada);
    const id = randomUUID();

    const creado = await this.prisma.$transaction(async (tx) => {
      const m = await tx.movimiento_programado.create({
        data: {
          id,
          serie_id: id,
          periodicidad: dto.periodicidad ?? null,
          dia: dto.periodicidad ? fecha.getUTCDate() : null,
          categoria_id: categoriaId,
          tipo: dto.tipo,
          monto_planificado: new Prisma.Decimal(dto.montoPlanificado),
          moneda,
          fecha_programada: fecha,
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
          periodicidad: dto.periodicidad ?? null,
          categoria_id: categoriaId,
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
    if (dto.categoriaId !== undefined && dto.categoriaId !== m.categoria_id) {
      data.categoria_id = await this.#validarCategoria(dto.categoriaId, m.tipo, actorId);
      anterior.categoria_id = m.categoria_id;
      posterior.categoria_id = dto.categoriaId;
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
          categoria_id: m.categoria_id,
          glosa: m.observaciones,
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
    if (dto.serie) return this.#dejarDeRepetir(m, actorId, dto.motivo);
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

  /**
   * D-6, "Dejar de repetir": la serie no genera más ocurrencias (periodicidad
   * NULL en todas sus filas) y se cancelan las pendientes que aún no llegan.
   * Las vencidas sin respuesta siguen pendientes: siguen preguntando "¿Se pagó?".
   */
  async #dejarDeRepetir(
    m: MovimientoRow,
    actorId: string,
    motivo: string,
  ): Promise<MovimientoProgramadoDTO> {
    if (!m.periodicidad) {
      throw errorConCodigo(BadRequestException, 'NO_SE_REPITE', 'El movimiento no se repite');
    }
    const hoy = this.#fecha(hoyChile());
    const actualizado = await this.prisma.$transaction(async (tx) => {
      const futuras = await tx.movimiento_programado.findMany({
        where: { serie_id: m.serie_id, estado: 'PENDIENTE', fecha_programada: { gt: hoy } },
        select: { id: true },
      });
      await tx.movimiento_programado.updateMany({
        where: { id: { in: futuras.map((f) => f.id) } },
        data: { estado: 'CANCELADO' },
      });
      await tx.movimiento_programado.updateMany({
        where: { serie_id: m.serie_id },
        data: { periodicidad: null, dia: null },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CancelarMovimientoProgramado',
        usuarioId: actorId,
        entidadTipo: 'MOVIMIENTO_PROGRAMADO',
        entidadId: m.id,
        motivo,
        valorAnterior: { periodicidad: m.periodicidad },
        valorPosterior: { periodicidad: null, canceladas: futuras.map((f) => f.id) },
      });
      return tx.movimiento_programado.findUniqueOrThrow({ where: { id: m.id } });
    });
    return toMovimientoProgramadoDTO(actualizado, await this.#eventoOrigen(m.id));
  }

  // ── Recurrencia y aviso "¿Se pagó?" (D-6) ─────────────────────────────────

  onApplicationBootstrap(): void {
    void this.revisarVencidos();
  }

  /**
   * Render free duerme el servicio: el cron solo corre despierto. Al despertar
   * (bootstrap) y al leer la lista también se revisa, así ningún aviso se
   * pierde; a lo más llega cuando se abre la app.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async programada(): Promise<void> {
    await this.revisarVencidos();
  }

  /**
   * 1. Cada serie cuya última ocurrencia llegó a su fecha genera la siguiente
   *    (y las que falten hasta pasar hoy). La ocurrencia generada deriva de la
   *    serie, como el aviso: no es un comando del usuario y no se audita; su
   *    materialización sí.
   * 2. Cada ocurrencia PENDIENTE que llegó a su fecha avisa una sola vez a los
   *    dueños del lado propio.
   * Idempotente: el índice único (serie_id, fecha) y la marca `avisado`
   * aguantan dos revisiones a la vez. Best-effort: nunca lanza.
   */
  async revisarVencidos(): Promise<void> {
    try {
      const hoy = this.#fecha(hoyChile());
      const cabezas = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT m.id FROM movimiento_programado m
        WHERE m.periodicidad IS NOT NULL AND m.fecha_programada <= ${hoy}
          AND NOT EXISTS (
            SELECT 1 FROM movimiento_programado n
            WHERE n.serie_id = m.serie_id AND n.fecha_programada > m.fecha_programada)`;
      for (const c of await this.prisma.movimiento_programado.findMany({
        where: { id: { in: cabezas.map((x) => x.id) } },
      })) {
        const filas: Prisma.movimiento_programadoCreateManyInput[] = [];
        let f = c.fecha_programada;
        // Tope de seguridad: una serie con fecha muy antigua no genera sin fin.
        for (let i = 0; i < 24 && f.getTime() <= hoy.getTime(); i++) {
          f = siguienteFecha(f, c.periodicidad as Periodicidad, c.dia!);
          filas.push({
            tipo: c.tipo,
            monto_planificado: c.monto_planificado,
            moneda: c.moneda,
            fecha_programada: f,
            elemento_origen_id: c.elemento_origen_id,
            elemento_destino_id: c.elemento_destino_id,
            observaciones: c.observaciones,
            estado: 'PENDIENTE',
            periodicidad: c.periodicidad,
            dia: c.dia,
            serie_id: c.serie_id,
            categoria_id: c.categoria_id,
          });
        }
        await this.prisma.movimiento_programado.createMany({ data: filas, skipDuplicates: true });
      }

      const vencidas = await this.prisma.movimiento_programado.findMany({
        where: { estado: 'PENDIENTE', avisado: false, fecha_programada: { lte: hoy } },
        orderBy: { fecha_programada: 'asc' },
      });
      for (const m of vencidas) await this.#avisar(m);
    } catch (e) {
      this.logger.warn(`No se pudieron revisar los programados vencidos: ${(e as Error).message}`);
    }
  }

  async #avisar(m: MovimientoRow): Promise<void> {
    const categoria = m.categoria_id
      ? await this.prisma.categoria_movimiento.findUnique({ where: { id: m.categoria_id } })
      : null;
    const nombre = m.observaciones || categoria?.nombre || NOMBRE_POR_TIPO[m.tipo] || 'Movimiento programado';
    const pregunta = m.tipo === 'INGRESO' ? '¿Llegó?' : '¿Se pagó?';
    const duenos = await this.prisma.elemento_propietario.findMany({
      where: { elemento_id: this.#ladoPropio(m) },
      select: { usuario_id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.movimiento_programado.updateMany({
        where: { id: m.id, avisado: false },
        data: { avisado: true },
      });
      if (count === 0) return; // otra revisión ya avisó
      for (const d of duenos) {
        await this.notificaciones.emitir(tx, {
          usuarioId: d.usuario_id,
          tipo: 'PROGRAMADO_VENCIDO',
          titulo: `${nombre} · ${texto(m.monto_planificado, m.moneda)}`,
          cuerpo: `${pregunta} Confírmalo o cambia el monto.`,
          entidadTipo: 'MOVIMIENTO_PROGRAMADO',
          entidadId: m.id,
        });
      }
    });
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtener(movimientoId: string, actorId: string): Promise<MovimientoProgramadoDTO> {
    const m = await this.#cargar(movimientoId, actorId);
    return toMovimientoProgramadoDTO(m, await this.#eventoOrigen(m.id));
  }

  async listar(actorId: string, estado?: string): Promise<MovimientoProgramadoDTO[]> {
    await this.revisarVencidos();
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

  /**
   * Misma regla que RegistrarEventoFinanciero (G23): ACTIVA, de un hogar del
   * actor y aplicable al tipo. Solo INGRESO y GASTO se categorizan.
   */
  async #validarCategoria(categoriaId: string | undefined, tipo: string, actorId: string): Promise<string | null> {
    if (!categoriaId) return null;
    if (tipo !== 'INGRESO' && tipo !== 'GASTO') {
      throw new BadRequestException('Solo los ingresos y gastos se categorizan');
    }
    const cat = await this.prisma.categoria_movimiento.findUnique({ where: { id: categoriaId } });
    if (!cat || cat.estado !== 'ACTIVA') throw new BadRequestException('Categoría no válida');
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: cat.hogar_id, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!m) throw new ForbiddenException('La categoría no pertenece a un hogar tuyo');
    if (cat.tipo_aplicable !== 'AMBOS' && cat.tipo_aplicable !== tipo) {
      throw new BadRequestException(`La categoría "${cat.nombre}" no aplica a ${tipo.toLowerCase()}s`);
    }
    return cat.id;
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
