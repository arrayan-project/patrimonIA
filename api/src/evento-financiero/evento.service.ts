import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ProgresoService } from '../planificacion/progreso.service.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { ConversionService } from '../tipo-cambio/conversion.service.js';
import { EtiquetaService } from '../etiqueta/etiqueta.service.js';
import { ElementoService } from '../elemento/elemento.service.js';
import { derivarValorPendiente } from '../common/deuda.js';
import { toEventoDTO, type EventoFinancieroDTO } from './evento.dto.js';
import type { RegistrarEventoDto } from './dto/registrar-evento.dto.js';
import type { AnularEventoDto } from './dto/anular-evento.dto.js';
import type { CorregirEventoDto } from './dto/corregir-evento.dto.js';

interface ImpactoPlan {
  elemento: ElementoRow;
  monto: Prisma.Decimal; // con signo: + entrada, − salida
}

@Injectable()
export class EventoFinancieroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly progreso: ProgresoService,
    private readonly notificaciones: NotificacionService,
    private readonly conversion: ConversionService,
    private readonly etiquetas: EtiquetaService,
    private readonly elementos: ElementoService,
  ) {}

  /**
   * AS #10 — RegistrarEventoFinanciero (Fase 2: INGRESO / GASTO / TRANSFERENCIA).
   * Validaciones: elementos afectados existen y están activos · transferencia
   * genera ≥2 impactos (por construcción).
   * Orquestación: generar impacto(s) · actualizar valor_vigente de cada elemento
   * afectado (desnormalizado, DATABASE_DESIGN §6). La política transversal de
   * recálculo (W) se resuelve en vivo en las proyecciones de lectura.
   * Auditoría: Creación — comando, usuario, fecha, monto, elementos afectados.
   */
  async registrarEvento(actorId: string, dto: RegistrarEventoDto): Promise<EventoFinancieroDTO> {
    const moneda = dto.moneda.toUpperCase();
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const monto = new Prisma.Decimal(dto.monto);

    const plan = await this.planImpactos(actorId, dto, moneda, monto, fecha);

    // Política "Consumir reserva": si el evento se asocia a una asignación propia.
    const asignacion = dto.asignacionId
      ? await this.#asignacionPropia(dto.asignacionId, actorId)
      : null;

    const categoriaId = await this.#validarCategoria(dto, actorId);

    const resultado = await this.prisma.$transaction(async (tx) => {
      const evento = await tx.evento_financiero.create({
        data: {
          tipo: dto.tipo,
          monto,
          moneda,
          fecha,
          anulado: false,
          asignacion_id: asignacion?.id ?? null,
          categoria_id: categoriaId,
          glosa: dto.glosa?.trim() || null,
        },
      });

      const impactos = [];
      for (const p of plan) {
        impactos.push(
          await tx.impacto_patrimonial.create({
            data: {
              elemento_id: p.elemento.id,
              monto: p.monto,
              origen_tipo: 'EVENTO_FINANCIERO',
              origen_id: evento.id,
              fecha,
            },
          }),
        );
        await tx.elemento_patrimonial.update({
          where: { id: p.elemento.id },
          data: { valor_vigente: new Prisma.Decimal(p.elemento.valor_vigente).plus(p.monto) },
        });
        await derivarValorPendiente(tx, p.elemento.id);
      }

      const reservasConsumidas = asignacion
        ? await this.#consumirReservas(tx, asignacion.id, monto, moneda, new Set(plan.map((p) => p.elemento.id)))
        : [];

      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'RegistrarEventoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'EVENTO_FINANCIERO',
        entidadId: evento.id,
        valorPosterior: {
          tipo: evento.tipo,
          monto: dto.monto,
          moneda,
          fecha: fecha.toISOString().slice(0, 10),
          impactos: plan.map((p) => ({
            elemento_id: p.elemento.id,
            monto: p.monto.toNumber(),
          })),
          ...(asignacion
            ? { asignacion_id: asignacion.id, reservas_consumidas: reservasConsumidas }
            : {}),
        },
      });

      if (asignacion && reservasConsumidas.length > 0) {
        const total = reservasConsumidas.reduce((s, r) => s + r.monto, 0);
        await this.notificaciones.emitir(tx, {
          usuarioId: actorId,
          tipo: 'RESERVA_CONSUMIDA',
          titulo: 'Se usó dinero apartado',
          cuerpo: `Se consumieron ${total} ${moneda} apartados en "${asignacion.nombre}" al asociarle un movimiento.`,
          entidadTipo: 'ASIGNACION',
          entidadId: asignacion.id,
        });
      }

      if (asignacion?.objetivo_financiero_id) {
        await this.progreso.recalcularYCompletar(
          tx,
          asignacion.objetivo_financiero_id,
          actorId,
          entradaId,
        );
      }

      const etiquetaIds = await this.etiquetas.adjuntarEnTx(
        tx,
        evento.id,
        dto.etiquetaIds ?? [],
        actorId,
      );

      return { evento, impactos, etiquetaIds };
    });

    return toEventoDTO(resultado.evento, resultado.impactos, resultado.etiquetaIds);
  }

  /**
   * AS #11 — AnularEventoFinanciero.
   * Validaciones: el evento existe y está vigente (no anulado); no puede anularse
   * un evento que ya tiene una corrección viva (anula/maneja primero la corrección).
   * Orquestación: revertir el efecto de sus impactos sobre valor_vigente y
   * marcarlo `anulado` — INMUTABLE salvo ese flag (DATABASE_DESIGN §4). Los
   * impacto_patrimonial se conservan pero quedan "marcados" vía evento.anulado
   * (se filtran en las lecturas de impactos).
   * Auditoría: Anulación — motivo, evento anulado.
   */
  async anularEvento(actorId: string, dto: AnularEventoDto): Promise<EventoFinancieroDTO> {
    const { evento, impactos } = await this.exigirAccesoEvento(dto.eventoId, actorId);
    if (evento.anulado) throw new ConflictException('El evento ya está anulado');
    if (evento.tipo === 'SALDO_INICIAL') {
      throw new BadRequestException(
        'El saldo inicial no se anula: ajústalo con un ajuste patrimonial o desactiva la cuenta',
      );
    }
    if (await this.tieneCorreccionViva(evento.id)) {
      throw new ConflictException('El evento tiene una corrección vigente — anúlala primero');
    }

    const anulado = await this.prisma.$transaction(async (tx) => {
      for (const i of impactos) {
        const el = await tx.elemento_patrimonial.findUniqueOrThrow({ where: { id: i.elemento_id } });
        await tx.elemento_patrimonial.update({
          where: { id: i.elemento_id },
          data: { valor_vigente: new Prisma.Decimal(el.valor_vigente).minus(i.monto) },
        });
        await derivarValorPendiente(tx, i.elemento_id);
      }

      // GAPS.md G14 — si el evento consumió reservas al registrarse, revertirlas
      // a ACTIVA (solo las que siguen CONSUMIDA — no las liberadas ni borradas).
      const reservasRevividas = await this.#reactivarReservasConsumidas(tx, evento.id);

      const actualizado = await tx.evento_financiero.update({
        where: { id: evento.id },
        data: { anulado: true },
      });

      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'AnularEventoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'EVENTO_FINANCIERO',
        entidadId: evento.id,
        motivo: dto.motivo,
        valorAnterior: { anulado: false },
        valorPosterior: {
          anulado: true,
          ...(reservasRevividas.length > 0 ? { reservas_revividas: reservasRevividas } : {}),
        },
      });

      if (reservasRevividas.length > 0 && evento.asignacion_id) {
        const asignacion = await tx.asignacion.findUnique({ where: { id: evento.asignacion_id } });
        if (asignacion?.objetivo_financiero_id) {
          await this.progreso.recalcularYCompletar(
            tx,
            asignacion.objetivo_financiero_id,
            actorId,
            entradaId,
          );
        }
      }

      return actualizado;
    });

    const etqs = (await this.etiquetas.deEventos([anulado.id])).get(anulado.id) ?? [];
    return toEventoDTO(anulado, impactos, etqs);
  }

  /**
   * AS #12 — CorregirEventoFinanciero. Patrón de corrección (DDD Sección T): el
   * evento original permanece intacto e inmutable; se INSERTA un evento
   * compensatorio con `correccion_de_id` apuntando al original. En Evento
   * Financiero la corrección **compensa montos** (flujo): impacto = signo del
   * impacto original × (nuevoMonto − montoOriginal).
   * GAPS.md P5 — además del monto se corrige la fecha y la glosa (opcionales, al
   * menos uno). El tipo/los elementos afectados siguen requiriendo anular +
   * registrar. La cadena sigue lineal (una sola corrección viva por evento).
   * Auditoría: Corrección — evento original, evento compensatorio, motivo.
   */
  async corregirEvento(actorId: string, dto: CorregirEventoDto): Promise<EventoFinancieroDTO> {
    const { evento, impactos } = await this.exigirAccesoEvento(dto.eventoId, actorId);
    if (evento.anulado) throw new ConflictException('No se puede corregir un evento anulado');
    if (evento.tipo === 'SALDO_INICIAL') {
      throw new BadRequestException(
        'El saldo inicial no se corrige: usa un ajuste patrimonial sobre la cuenta',
      );
    }
    if (evento.tipo === 'CONVERSION') {
      throw new BadRequestException(
        'Una CONVERSION se corrige anulándola y registrándola de nuevo (la tasa cambia ambos lados)',
      );
    }
    if (await this.tieneCorreccionViva(evento.id)) {
      throw new ConflictException('El evento ya tiene una corrección — corrige esa última');
    }

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const montoFinal = dto.nuevoMonto != null ? new Prisma.Decimal(dto.nuevoMonto) : evento.monto;
    const delta = montoFinal.minus(evento.monto); // p.ej. 45.000 − 50.000 = −5.000
    const fechaFinal = dto.nuevaFecha ? new Date(dto.nuevaFecha) : evento.fecha;
    const fechaCambia = iso(fechaFinal) !== iso(evento.fecha);
    const glosaFinal =
      dto.nuevaGlosa !== undefined ? dto.nuevaGlosa.trim() || null : evento.glosa;
    const glosaCambia = glosaFinal !== evento.glosa;

    const valorAnterior: Record<string, unknown> = {};
    const valorPosterior: Record<string, unknown> = {};
    if (!delta.isZero()) {
      valorAnterior.monto = evento.monto.toNumber();
      valorPosterior.monto = montoFinal.toNumber();
    }
    if (fechaCambia) {
      valorAnterior.fecha = iso(evento.fecha);
      valorPosterior.fecha = iso(fechaFinal);
    }
    if (glosaCambia) {
      valorAnterior.glosa = evento.glosa;
      valorPosterior.glosa = glosaFinal;
    }
    if (Object.keys(valorPosterior).length === 0) {
      throw new BadRequestException('No hay nada que corregir — los datos son iguales a los actuales');
    }

    // La corrección hereda las etiquetas del original (como la categoría).
    const etiquetasOriginal = (await this.etiquetas.deEventos([evento.id])).get(evento.id) ?? [];

    const resultado = await this.prisma.$transaction(async (tx) => {
      const compensatorio = await tx.evento_financiero.create({
        data: {
          tipo: evento.tipo,
          monto: delta.isZero() ? evento.monto : delta.abs(),
          moneda: evento.moneda,
          fecha: fechaFinal,
          correccion_de_id: evento.id,
          anulado: false,
          categoria_id: evento.categoria_id,
          glosa: glosaFinal,
        },
      });

      const nuevosImpactos = [];
      if (!delta.isZero()) {
        for (const i of impactos) {
          const signo = new Prisma.Decimal(i.monto).isNegative() ? -1 : 1;
          const montoComp = delta.times(signo); // signo del impacto original × delta
          nuevosImpactos.push(
            await tx.impacto_patrimonial.create({
              data: {
                elemento_id: i.elemento_id,
                monto: montoComp,
                origen_tipo: 'EVENTO_FINANCIERO',
                origen_id: compensatorio.id,
                fecha: fechaFinal,
              },
            }),
          );
          const el = await tx.elemento_patrimonial.findUniqueOrThrow({
            where: { id: i.elemento_id },
          });
          await tx.elemento_patrimonial.update({
            where: { id: i.elemento_id },
            data: { valor_vigente: new Prisma.Decimal(el.valor_vigente).plus(montoComp) },
          });
          await derivarValorPendiente(tx, i.elemento_id);
        }
      }

      await this.auditoria.registrar(tx, {
        comando: 'CorregirEventoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'EVENTO_FINANCIERO',
        entidadId: evento.id,
        motivo: dto.motivo,
        valorAnterior,
        valorPosterior,
        entidadRelacionadaTipo: 'EVENTO_FINANCIERO',
        entidadRelacionadaId: compensatorio.id,
      });

      if (etiquetasOriginal.length > 0) {
        await this.etiquetas.adjuntarEnTx(tx, compensatorio.id, etiquetasOriginal, actorId);
      }

      return { compensatorio, nuevosImpactos };
    });

    return toEventoDTO(resultado.compensatorio, resultado.nuevosImpactos, etiquetasOriginal);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtenerEvento(eventoId: string, actorId: string): Promise<EventoFinancieroDTO> {
    const evento = await this.prisma.evento_financiero.findUnique({ where: { id: eventoId } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: eventoId },
    });
    if (!(await this.actorVeAlgunElemento(impactos.map((i) => i.elemento_id), actorId))) {
      throw new NotFoundException('Evento no encontrado');
    }
    const etqs = (await this.etiquetas.deEventos([eventoId])).get(eventoId) ?? [];
    return toEventoDTO(evento, impactos, etqs);
  }

  /**
   * G14 — política "Consumir reserva": consume reservas ACTIVAS de la asignación
   * solo hasta el monto del evento. Solo cuentan las de la misma moneda y las que
   * están sobre un elemento que el evento mueve, de la más antigua a la más nueva
   * (G33 HZ-13: la plata ahorrada en otra cuenta no se movió, así que no se toca;
   * lo que no cubren sale de lo libre de la cuenta).
   * Si una queda a medias se divide: la fila original baja al monto consumido y
   * pasa a CONSUMIDA, y el resto queda en una reserva ACTIVA nueva (`resto_id`).
   * Así los estados siguen siendo binarios y anular el evento solo tiene que
   * reactivar los ids consumidos (el total reservado vuelve a ser el mismo).
   */
  async #consumirReservas(
    tx: Prisma.TransactionClient,
    asignacionId: string,
    monto: Prisma.Decimal,
    moneda: string,
    elementosEvento: Set<string>,
  ): Promise<{ id: string; monto: number; resto_id?: string }[]> {
    const candidatas = await tx.reserva.findMany({
      where: {
        asignacion_id: asignacionId,
        estado: 'ACTIVA',
        elemento_origen_id: { in: [...elementosEvento] },
        elemento_patrimonial: { moneda },
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });

    const consumidas: { id: string; monto: number; resto_id?: string }[] = [];
    let restante = monto;
    for (const r of candidatas) {
      if (restante.lte(0)) break;
      const montoReserva = new Prisma.Decimal(r.monto);
      if (montoReserva.lte(restante)) {
        await tx.reserva.update({ where: { id: r.id }, data: { estado: 'CONSUMIDA' } });
        consumidas.push({ id: r.id, monto: montoReserva.toNumber() });
        restante = restante.minus(montoReserva);
      } else {
        const resto = await tx.reserva.create({
          data: {
            asignacion_id: r.asignacion_id,
            elemento_origen_id: r.elemento_origen_id,
            monto: montoReserva.minus(restante),
            estado: 'ACTIVA',
          },
        });
        await tx.reserva.update({ where: { id: r.id }, data: { monto: restante, estado: 'CONSUMIDA' } });
        consumidas.push({ id: r.id, monto: restante.toNumber(), resto_id: resto.id });
        restante = new Prisma.Decimal(0);
      }
    }
    return consumidas;
  }

  /**
   * G14 — reactiva las reservas que este evento consumió al registrarse. Lee la
   * lista de la entrada de auditoría `RegistrarEventoFinanciero` (embebida en
   * `valor_posterior.reservas_consumidas`). Devuelve los ids efectivamente
   * revividos (los que seguían CONSUMIDA).
   */
  async #reactivarReservasConsumidas(
    tx: Prisma.TransactionClient,
    eventoId: string,
  ): Promise<string[]> {
    const registro = await tx.auditoria.findFirst({
      where: { comando: 'RegistrarEventoFinanciero', entidad_id: eventoId },
      orderBy: { fecha_hora: 'asc' },
    });
    const vp = (registro?.valor_posterior ?? {}) as {
      reservas_consumidas?: { id: string }[];
    };
    const ids = (vp.reservas_consumidas ?? []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return [];
    const vivas = await tx.reserva.findMany({
      where: { id: { in: ids }, estado: 'CONSUMIDA' },
      select: { id: true },
    });
    if (vivas.length === 0) return [];
    await tx.reserva.updateMany({
      where: { id: { in: vivas.map((r) => r.id) } },
      data: { estado: 'ACTIVA' },
    });
    return vivas.map((r) => r.id);
  }

  async listarPorElemento(elementoId: string, actorId: string): Promise<EventoFinancieroDTO[]> {
    // §B1 — propietario, o co-miembro con visibilidad de MOVIMIENTOS.
    if (!(await this.elementos.puedeVerMovimientos(elementoId, actorId))) {
      throw new ForbiddenException('No puedes ver los movimientos de ese elemento');
    }
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { elemento_id: elementoId, origen_tipo: 'EVENTO_FINANCIERO' },
      orderBy: { created_at: 'desc' },
    });
    const eventos = await this.prisma.evento_financiero.findMany({
      where: { id: { in: impactos.map((i) => i.origen_id) } },
      orderBy: { fecha: 'desc' },
    });
    const impactosPorEvento = new Map<string, typeof impactos>();
    for (const i of impactos) {
      const arr = impactosPorEvento.get(i.origen_id) ?? [];
      arr.push(i);
      impactosPorEvento.set(i.origen_id, arr);
    }
    const etqs = await this.etiquetas.deEventos(eventos.map((e) => e.id));
    return eventos.map((e) =>
      toEventoDTO(e, impactosPorEvento.get(e.id) ?? [], etqs.get(e.id) ?? []),
    );
  }

  // ── Armado y validación del plan de impactos ──────────────────────────────

  private async planImpactos(
    actorId: string,
    dto: RegistrarEventoDto,
    moneda: string,
    monto: Prisma.Decimal,
    fecha: Date,
  ): Promise<ImpactoPlan[]> {
    const cargar = async (id: string): Promise<ElementoRow> => {
      const el = await this.prisma.elemento_patrimonial.findUnique({ where: { id } });
      if (!el) throw new NotFoundException('Elemento no encontrado');
      if (el.estado !== 'ACTIVO') throw new BadRequestException('El elemento no está activo');
      return el;
    };

    if (dto.tipo === 'INGRESO') {
      if (!dto.elementoDestinoId || dto.elementoOrigenId) {
        throw new BadRequestException('INGRESO requiere solo elementoDestinoId');
      }
      const destino = await cargar(dto.elementoDestinoId);
      await this.exigirPropietario(destino.id, actorId);
      this.exigirMoneda(destino, moneda);
      return [{ elemento: destino, monto }];
    }

    if (dto.tipo === 'GASTO') {
      if (!dto.elementoOrigenId || dto.elementoDestinoId) {
        throw new BadRequestException('GASTO requiere solo elementoOrigenId');
      }
      const origen = await cargar(dto.elementoOrigenId);
      await this.exigirPropietario(origen.id, actorId);
      this.exigirMoneda(origen, moneda);
      return [{ elemento: origen, monto: monto.negated() }];
    }

    // TRANSFERENCIA y CONVERSION comparten estructura (origen + destino).
    if (!dto.elementoOrigenId || !dto.elementoDestinoId) {
      throw new BadRequestException(`${dto.tipo} requiere elementoOrigenId y elementoDestinoId`);
    }
    if (dto.elementoOrigenId === dto.elementoDestinoId) {
      throw new BadRequestException('Origen y destino no pueden ser el mismo elemento');
    }
    const origen = await cargar(dto.elementoOrigenId);
    const destino = await cargar(dto.elementoDestinoId);
    await this.exigirPropietario(origen.id, actorId); // solo mueves plata de lo tuyo
    this.exigirMoneda(origen, moneda); // el monto del evento va en la moneda del origen
    if (!(await this.actorPuedeRecibirEn(destino, actorId))) {
      throw new ForbiddenException('No puedes mover fondos a ese elemento destino');
    }

    if (dto.tipo === 'CONVERSION') {
      if (origen.moneda === destino.moneda) {
        throw new BadRequestException('CONVERSION requiere monedas distintas — usa TRANSFERENCIA');
      }
      const montoDestino = await this.conversion.convertir(
        monto,
        origen.moneda,
        destino.moneda,
        fecha,
      );
      return [
        { elemento: origen, monto: monto.negated() },
        { elemento: destino, monto: montoDestino },
      ];
    }

    // TRANSFERENCIA
    if (origen.moneda !== destino.moneda) {
      throw new BadRequestException('Transferencia entre monedas distintas es una CONVERSION');
    }
    return [
      { elemento: origen, monto: monto.negated() },
      { elemento: destino, monto },
    ];
  }

  private exigirMoneda(elemento: ElementoRow, moneda: string): void {
    if (elemento.moneda !== moneda) {
      throw new BadRequestException(
        `La moneda del evento (${moneda}) no coincide con la del elemento (${elemento.moneda})`,
      );
    }
  }

  private async exigirPropietario(elementoId: string, actorId: string): Promise<void> {
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario de ese elemento');
  }

  /** Destino de transferencia: propio, o de un co-miembro de hogar. Ver GAPS.md G6. */
  private async actorPuedeRecibirEn(destino: ElementoRow, actorId: string): Promise<boolean> {
    const propDestino = await this.prisma.elemento_propietario.findMany({
      where: { elemento_id: destino.id },
      select: { usuario_id: true },
    });
    if (propDestino.some((p) => p.usuario_id === actorId)) return true;

    const hogaresActor = await this.prisma.membresia.findMany({
      where: { usuario_id: actorId, estado: 'ACTIVA' },
      select: { hogar_id: true },
    });
    const setActor = new Set(hogaresActor.map((m) => m.hogar_id));
    const hogaresDestino = await this.prisma.membresia.findMany({
      where: { usuario_id: { in: propDestino.map((p) => p.usuario_id) }, estado: 'ACTIVA' },
      select: { hogar_id: true },
    });
    return hogaresDestino.some((m) => setActor.has(m.hogar_id));
  }

  private async actorVeAlgunElemento(elementoIds: string[], actorId: string): Promise<boolean> {
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: { in: elementoIds }, usuario_id: actorId },
    });
    return prop !== null;
  }

  /** Carga el evento + sus impactos y exige que el actor sea propietario de
   *  algún elemento afectado. */
  private async exigirAccesoEvento(eventoId: string, actorId: string) {
    const evento = await this.prisma.evento_financiero.findUnique({ where: { id: eventoId } });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: eventoId },
    });
    if (!(await this.actorVeAlgunElemento(impactos.map((i) => i.elemento_id), actorId))) {
      throw new NotFoundException('Evento no encontrado');
    }
    return { evento, impactos };
  }

  /**
   * Valida la categoría (GAPS.md G23): debe ser ACTIVA, de un hogar del actor, y
   * su `tipo_aplicable` compatible con el tipo del evento. Solo INGRESO/GASTO se
   * categorizan. Devuelve el id validado o null.
   */
  async #validarCategoria(dto: RegistrarEventoDto, actorId: string): Promise<string | null> {
    if (!dto.categoriaId) return null;
    if (dto.tipo !== 'INGRESO' && dto.tipo !== 'GASTO') {
      throw new BadRequestException('Solo los ingresos y gastos se categorizan');
    }
    const cat = await this.prisma.categoria_movimiento.findUnique({
      where: { id: dto.categoriaId },
    });
    if (!cat || cat.estado !== 'ACTIVA') throw new BadRequestException('Categoría no válida');
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: cat.hogar_id, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!m) throw new ForbiddenException('La categoría no pertenece a un hogar tuyo');
    if (cat.tipo_aplicable !== 'AMBOS' && cat.tipo_aplicable !== dto.tipo) {
      throw new BadRequestException(
        `La categoría "${cat.nombre}" no aplica a ${dto.tipo.toLowerCase()}s`,
      );
    }
    return cat.id;
  }

  /**
   * La asignación es del actor o de una meta del hogar que puede modificar
   * (dueño o designado, P9): así se puede gastar desde la parte que creó otro
   * miembro, como ya se puede ahorrar en ella (G33).
   */
  async #asignacionPropia(asignacionId: string, actorId: string) {
    const a = await this.prisma.asignacion.findUnique({ where: { id: asignacionId } });
    if (!a) throw new NotFoundException('Asignación no encontrada');
    if (a.usuario_id === actorId) return a;
    if (a.objetivo_financiero_id) {
      const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: a.objetivo_financiero_id } });
      if (o?.usuario_id === actorId) return a;
      if (o?.hogar_id) {
        const d = await this.prisma.objetivo_designado.findUnique({
          where: { objetivo_id_usuario_id: { objetivo_id: o.id, usuario_id: actorId } },
        });
        if (d) return a;
      }
    }
    throw new ForbiddenException('La asignación no es tuya');
  }

  /** ¿Hay una corrección no-anulada apuntando a este evento? */
  private async tieneCorreccionViva(eventoId: string): Promise<boolean> {
    const corr = await this.prisma.evento_financiero.findFirst({
      where: { correccion_de_id: eventoId, anulado: false },
    });
    return corr !== null;
  }
}
