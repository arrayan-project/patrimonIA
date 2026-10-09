import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EventoFinancieroService } from '../evento-financiero/evento.service.js';
import { ElementoService } from '../elemento/elemento.service.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import type { EventoFinancieroDTO } from '../evento-financiero/evento.dto.js';
import { errorConCodigo } from '../common/errores.js';
import type {
  AvisarTransferenciaSinAnotarDto,
  PagarSolicitudDto,
  RechazarSolicitudDto,
  RegistrarGastoCompartidoDto,
} from './dto/solicitud.dto.js';

export type EstadoSolicitud = 'PENDIENTE' | 'PAGADA' | 'RECHAZADA' | 'ANULADA';

export interface SolicitudDTO {
  id: string;
  motivo: 'GASTO_COMPARTIDO' | 'SIN_ANOTAR';
  estado: EstadoSolicitud;
  /** Desde el punto de vista del actor: ENVIADA (la pidió) o RECIBIDA (le toca anotar). */
  direccion: 'ENVIADA' | 'RECIBIDA';
  solicitante: { id: string; nombre: string };
  destinatario: { id: string; nombre: string };
  monto: number;
  moneda: string;
  cuentaDestino: { id: string; nombre: string };
  /**
   * Solo en una RECIBIDA pendiente: false si quien la pidió dejó de compartir la
   * cuenta (D-2) y no se puede transferir a ella.
   */
  cuentaDisponible: boolean;
  /** Fecha del gasto o de cuando llegó la plata (YYYY-MM-DD). */
  fecha: string;
  /** En qué fue: glosa o categoría del gasto. */
  glosa: string | null;
  /** GASTO_COMPARTIDO: el total que pagó quien la pidió. */
  totalGasto: number | null;
  eventoGastoId: string | null;
  eventoPagoId: string | null;
  createdAt: string;
}

/** Una TRANSFERENCIA entre una cuenta tuya y la de otro miembro del hogar. */
export interface TransferenciaHogarDTO {
  eventoId: string;
  /** ENVIADA: salió de tu cuenta. RECIBIDA: llegó a tu cuenta. */
  direccion: 'ENVIADA' | 'RECIBIDA';
  miembro: { id: string; nombre: string };
  cuentaPropia: { id: string; nombre: string };
  monto: number;
  moneda: string;
  fecha: string;
  glosa: string | null;
}

export interface ResultadoGastoCompartidoDTO {
  gasto: EventoFinancieroDTO;
  solicitudes: SolicitudDTO[];
}

/** Las cuentas donde se recibe una transferencia de un miembro. */
const RECIBEN = ['LIQUIDEZ', 'RESERVA'];

const incluir = {
  solicitante: { select: { id: true, nombre: true } },
  destinatario: { select: { id: true, nombre: true } },
  elemento_patrimonial: true,
  evento_gasto: { select: { monto: true, anulado: true } },
  evento_pago: { select: { anulado: true } },
} satisfies Prisma.solicitud_transferenciaInclude;

type Fila = Prisma.solicitud_transferenciaGetPayload<{ include: typeof incluir }>;

/** Un pago vigente manda: la plata ya se movió aunque después se anule el gasto. */
function estadoDe(s: Fila): EstadoSolicitud {
  if (s.evento_pago && !s.evento_pago.anulado) return 'PAGADA';
  if (s.evento_gasto?.anulado) return 'ANULADA';
  if (s.rechazada) return 'RECHAZADA';
  return 'PENDIENTE';
}

/** "30.000 CLP", como los textos de la app. */
function texto(monto: number | Prisma.Decimal, moneda: string): string {
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(monto))} ${moneda}`;
}

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * G33 bloque 9 — D-7 (M7) y "Avisarle a [miembro]" (Recibí → De alguien del
 * hogar). Un miembro le pide a otro que anote una TRANSFERENCIA hacia una
 * cuenta suya. La solicitud es una tabla de apoyo, como `notificacion`
 * (Principio 4): no mueve saldos ni genera auditoría; el gasto y la
 * transferencia son eventos normales, con su propia auditoría. El estado se
 * deriva al leer (`estadoDe`).
 */
@Injectable()
export class SolicitudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventoFinancieroService,
    private readonly elementos: ElementoService,
    private readonly notificaciones: NotificacionService,
  ) {}

  /** D-7: el gasto por el total y una solicitud por cada parte, en una transacción. */
  async registrarGastoCompartido(
    actorId: string,
    dto: RegistrarGastoCompartidoDto,
  ): Promise<ResultadoGastoCompartidoDTO> {
    const moneda = dto.moneda.toUpperCase();
    const ids = dto.partes.map((p) => p.usuarioId);
    if (new Set(ids).size !== ids.length || ids.includes(actorId)) {
      throw errorConCodigo(BadRequestException, 'PARTES_NO_VALIDAS', 'Cada parte es de un miembro distinto de ti');
    }
    const suma = dto.partes.reduce((s, p) => s.plus(p.monto), new Prisma.Decimal(0));
    if (suma.greaterThan(dto.monto)) {
      throw errorConCodigo(BadRequestException, 'PARTES_SUPERAN_TOTAL', 'Las partes suman más que el gasto');
    }
    const cuenta = await this.#cuentaParaRecibir(dto.cuentaDestinoId, actorId, moneda);
    const hogares = new Map<string, string>();
    for (const id of ids) {
      hogares.set(id, await this.#hogarComun(actorId, id));
      await this.#exigirVisible(cuenta, id);
    }
    const glosa = dto.glosa?.trim() || (await this.#categoria(dto.categoriaId)) || null;
    const fecha = dto.fecha?.slice(0, 10) ?? hoy();

    return this.prisma.$transaction(async (tx) => {
      const gasto = await this.eventos.registrarEventoEnTx(tx, actorId, {
        tipo: 'GASTO',
        monto: dto.monto,
        moneda,
        fecha,
        elementoOrigenId: dto.elementoOrigenId,
        ...(dto.asignacionId ? { asignacionId: dto.asignacionId } : {}),
        ...(dto.categoriaId ? { categoriaId: dto.categoriaId } : {}),
        ...(dto.glosa ? { glosa: dto.glosa } : {}),
        ...(dto.etiquetaIds ? { etiquetaIds: dto.etiquetaIds } : {}),
      });
      const filas: Fila[] = [];
      for (const p of dto.partes) {
        const s = await tx.solicitud_transferencia.create({
          data: {
            motivo: 'GASTO_COMPARTIDO',
            hogar_id: hogares.get(p.usuarioId)!,
            solicitante_id: actorId,
            destinatario_id: p.usuarioId,
            monto: new Prisma.Decimal(p.monto),
            moneda,
            elemento_destino_id: cuenta.id,
            evento_gasto_id: gasto.id,
            fecha: new Date(fecha),
            glosa,
          },
          include: incluir,
        });
        await this.notificaciones.emitir(tx, {
          usuarioId: p.usuarioId,
          tipo: 'SOLICITUD_APORTE',
          titulo: `${s.solicitante.nombre} te pide tu parte`,
          cuerpo: `Pagó ${texto(dto.monto, moneda)}${glosa ? ` en ${glosa}` : ''}. Tu parte: ${texto(p.monto, moneda)}.`,
          entidadTipo: 'SOLICITUD_TRANSFERENCIA',
          entidadId: s.id,
        });
        filas.push(s);
      }
      return { gasto, solicitudes: filas.map((s) => this.#dto(s, actorId, true)) };
    });
  }

  /** Recibí → De alguien del hogar: la plata llegó, pero quien la envió no la anotó. */
  async avisarSinAnotar(actorId: string, dto: AvisarTransferenciaSinAnotarDto): Promise<SolicitudDTO> {
    if (dto.usuarioId === actorId) {
      throw errorConCodigo(BadRequestException, 'PARTES_NO_VALIDAS', 'El aviso es para otro miembro');
    }
    const hogarId = await this.#hogarComun(actorId, dto.usuarioId);
    const cuenta = await this.#cuentaParaRecibir(dto.cuentaDestinoId, actorId);
    await this.#exigirVisible(cuenta, dto.usuarioId);
    const fecha = dto.fecha?.slice(0, 10) ?? hoy();

    return this.prisma.$transaction(async (tx) => {
      const s = await tx.solicitud_transferencia.create({
        data: {
          motivo: 'SIN_ANOTAR',
          hogar_id: hogarId,
          solicitante_id: actorId,
          destinatario_id: dto.usuarioId,
          monto: new Prisma.Decimal(dto.monto),
          moneda: cuenta.moneda,
          elemento_destino_id: cuenta.id,
          fecha: new Date(fecha),
        },
        include: incluir,
      });
      await this.notificaciones.emitir(tx, {
        usuarioId: dto.usuarioId,
        tipo: 'AVISO_TRANSFERENCIA',
        titulo: `${s.solicitante.nombre} te pide anotar una transferencia`,
        cuerpo: `Le llegaron ${texto(dto.monto, cuenta.moneda)} tuyos y no están anotados. Anótalos para que no falten.`,
        entidadTipo: 'SOLICITUD_TRANSFERENCIA',
        entidadId: s.id,
      });
      return this.#dto(s, actorId, true);
    });
  }

  /** El destinatario anota la TRANSFERENCIA con RegistrarEventoFinanciero, en la misma transacción. */
  async pagar(actorId: string, dto: PagarSolicitudDto): Promise<SolicitudDTO> {
    const s = await this.#recibidaPendiente(dto.solicitudId, actorId);
    const fecha = dto.fecha?.slice(0, 10) ?? (s.motivo === 'SIN_ANOTAR' ? s.fecha.toISOString().slice(0, 10) : hoy());
    const glosa =
      s.motivo === 'GASTO_COMPARTIDO'
        ? `Mi parte${s.glosa ? ` de ${s.glosa}` : ''}`.slice(0, 140)
        : `Para ${s.solicitante.nombre}`.slice(0, 140);

    return this.prisma.$transaction(async (tx) => {
      // Valida origen propio, moneda y destino visible (DESTINO_NO_PERMITIDO, D-2).
      const pago = await this.eventos.registrarEventoEnTx(tx, actorId, {
        tipo: 'TRANSFERENCIA',
        monto: s.monto.toNumber(),
        moneda: s.moneda,
        fecha,
        elementoOrigenId: dto.elementoOrigenId,
        elementoDestinoId: s.elemento_destino_id,
        glosa,
      });
      // Si otro pago se adelantó (dos toques), el segundo no pisa al primero.
      const r = await tx.solicitud_transferencia.updateMany({
        where: { id: s.id, evento_pago_id: s.evento_pago_id },
        data: { evento_pago_id: pago.id },
      });
      if (r.count === 0) {
        throw errorConCodigo(ConflictException, 'SOLICITUD_RESUELTA', 'La solicitud ya está resuelta');
      }
      await this.#avisoRespondido(tx, actorId, s.id);
      await this.notificaciones.emitir(tx, {
        usuarioId: s.solicitante_id,
        tipo: 'SOLICITUD_PAGADA',
        titulo:
          s.motivo === 'GASTO_COMPARTIDO'
            ? `${s.destinatario.nombre} te transfirió su parte`
            : `${s.destinatario.nombre} anotó la transferencia`,
        cuerpo: `${texto(s.monto, s.moneda)} a ${s.elemento_patrimonial.nombre}${s.glosa ? `, por ${s.glosa}` : ''}.`,
        entidadTipo: 'SOLICITUD_TRANSFERENCIA',
        entidadId: s.id,
      });
      return this.#dto(
        await tx.solicitud_transferencia.findUniqueOrThrow({ where: { id: s.id }, include: incluir }),
        actorId,
        true,
      );
    });
  }

  /** "No me corresponde": queda rechazada y se le avisa a quien la pidió. */
  async rechazar(actorId: string, dto: RechazarSolicitudDto): Promise<SolicitudDTO> {
    const s = await this.#recibidaPendiente(dto.solicitudId, actorId);
    return this.prisma.$transaction(async (tx) => {
      const fila = await tx.solicitud_transferencia.update({
        where: { id: s.id },
        data: { rechazada: true },
        include: incluir,
      });
      await this.#avisoRespondido(tx, actorId, s.id);
      await this.notificaciones.emitir(tx, {
        usuarioId: s.solicitante_id,
        tipo: 'SOLICITUD_RECHAZADA',
        titulo: `${s.destinatario.nombre} dice que no le corresponde`,
        cuerpo: `${texto(s.monto, s.moneda)}${s.glosa ? ` de ${s.glosa}` : ''}.`,
        entidadTipo: 'SOLICITUD_TRANSFERENCIA',
        entidadId: s.id,
      });
      return this.#dto(fila, actorId, true);
    });
  }

  /** Las solicitudes del actor en las dos direcciones, más recientes primero. */
  async listar(actorId: string): Promise<SolicitudDTO[]> {
    const filas = await this.prisma.solicitud_transferencia.findMany({
      where: { OR: [{ solicitante_id: actorId }, { destinatario_id: actorId }] },
      include: incluir,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    const out: SolicitudDTO[] = [];
    for (const s of filas) {
      const recibidaPendiente = s.destinatario_id === actorId && estadoDe(s) === 'PENDIENTE';
      const disponible = recibidaPendiente
        ? s.elemento_patrimonial.estado === 'ACTIVO' &&
          (await this.elementos.puedeRecibirTransferencia(s.elemento_patrimonial, actorId))
        : true;
      out.push(this.#dto(s, actorId, disponible));
    }
    return out;
  }

  /**
   * HZ-21 y Recibí → De alguien del hogar: las transferencias vigentes de los
   * últimos `dias` entre tus cuentas y las de otros miembros. Se arma aquí
   * porque los movimientos de una cuenta solo traen el impacto de esa cuenta y
   * no dicen de quién es el otro lado.
   */
  async transferenciasHogar(actorId: string, dias: number): Promise<TransferenciaHogarDTO[]> {
    const miembros = await this.prisma.membresia.findMany({
      where: {
        estado: 'ACTIVA',
        usuario_id: { not: actorId },
        hogar: { membresia: { some: { usuario_id: actorId, estado: 'ACTIVA' } } },
      },
      select: { usuario: { select: { id: true, nombre: true } } },
    });
    const otros = new Map(miembros.map((m) => [m.usuario.id, m.usuario]));
    if (otros.size === 0) return [];
    const propias = await this.prisma.elemento_patrimonial.findMany({
      where: { elemento_propietario: { some: { usuario_id: actorId } } },
      select: { id: true, nombre: true },
    });
    const propiasPorId = new Map(propias.map((e) => [e.id, e]));
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const deMisCuentas = await this.prisma.impacto_patrimonial.findMany({
      where: { origen_tipo: 'EVENTO_FINANCIERO', elemento_id: { in: [...propiasPorId.keys()] }, fecha: { gte: desde } },
      select: { origen_id: true },
    });
    const eventos = await this.prisma.evento_financiero.findMany({
      where: {
        id: { in: deMisCuentas.map((i) => i.origen_id) },
        tipo: 'TRANSFERENCIA',
        anulado: false,
        correccion_de_id: null,
      },
      select: { id: true },
    });
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: { in: eventos.map((e) => e.id) } },
      include: { elemento_patrimonial: { select: { elemento_propietario: { select: { usuario_id: true } } } } },
    });
    const porEvento = new Map<string, typeof impactos>();
    for (const i of impactos) porEvento.set(i.origen_id, [...(porEvento.get(i.origen_id) ?? []), i]);

    const ids: { eventoId: string; mio: (typeof impactos)[number]; miembroId: string }[] = [];
    for (const [eventoId, imps] of porEvento) {
      const mio = imps.find((i) => propiasPorId.has(i.elemento_id));
      const otro = imps.find((i) => !propiasPorId.has(i.elemento_id));
      const miembroId = otro?.elemento_patrimonial.elemento_propietario.find((p) => otros.has(p.usuario_id))?.usuario_id;
      if (mio && miembroId) ids.push({ eventoId, mio, miembroId });
    }
    const filas = await this.prisma.evento_financiero.findMany({ where: { id: { in: ids.map((x) => x.eventoId) } } });
    const evPorId = new Map(filas.map((e) => [e.id, e]));
    return ids
      .map(({ eventoId, mio, miembroId }) => {
        const ev = evPorId.get(eventoId)!;
        return {
          eventoId,
          direccion: mio.monto.greaterThan(0) ? ('RECIBIDA' as const) : ('ENVIADA' as const),
          miembro: otros.get(miembroId)!,
          cuentaPropia: propiasPorId.get(mio.elemento_id)!,
          monto: ev.monto.toNumber(),
          moneda: ev.moneda,
          fecha: ev.fecha.toISOString().slice(0, 10),
          glosa: ev.glosa,
        };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /** El aviso que pedía responder ya no queda como pendiente de leer. */
  async #avisoRespondido(tx: Prisma.TransactionClient, actorId: string, solicitudId: string): Promise<void> {
    await tx.notificacion.updateMany({
      where: { usuario_id: actorId, entidad_tipo: 'SOLICITUD_TRANSFERENCIA', entidad_id: solicitudId, leida: false },
      data: { leida: true },
    });
  }

  #dto(s: Fila, actorId: string, cuentaDisponible: boolean): SolicitudDTO {
    return {
      id: s.id,
      motivo: s.motivo as SolicitudDTO['motivo'],
      estado: estadoDe(s),
      direccion: s.solicitante_id === actorId ? 'ENVIADA' : 'RECIBIDA',
      solicitante: s.solicitante,
      destinatario: s.destinatario,
      monto: s.monto.toNumber(),
      moneda: s.moneda,
      cuentaDestino: { id: s.elemento_patrimonial.id, nombre: s.elemento_patrimonial.nombre },
      cuentaDisponible,
      fecha: s.fecha.toISOString().slice(0, 10),
      glosa: s.glosa,
      totalGasto: s.evento_gasto ? s.evento_gasto.monto.toNumber() : null,
      eventoGastoId: s.evento_gasto_id,
      eventoPagoId: s.evento_pago_id,
      createdAt: s.created_at.toISOString(),
    };
  }

  async #recibidaPendiente(solicitudId: string, actorId: string): Promise<Fila> {
    const s = await this.prisma.solicitud_transferencia.findUnique({ where: { id: solicitudId }, include: incluir });
    if (!s || (s.destinatario_id !== actorId && s.solicitante_id !== actorId)) {
      throw errorConCodigo(NotFoundException, 'SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada');
    }
    if (s.destinatario_id !== actorId) {
      throw errorConCodigo(ForbiddenException, 'SOLICITUD_AJENA', 'La solicitud la resuelve el otro miembro');
    }
    if (estadoDe(s) !== 'PENDIENTE') {
      throw errorConCodigo(ConflictException, 'SOLICITUD_RESUELTA', 'La solicitud ya está resuelta');
    }
    return s;
  }

  /** Una cuenta propia y activa que puede recibir plata (no un bien, una deuda ni el saldo con una persona). */
  async #cuentaParaRecibir(elementoId: string, actorId: string, moneda?: string): Promise<ElementoRow> {
    const e = await this.prisma.elemento_patrimonial.findUnique({
      where: { id: elementoId },
      include: { elemento_propietario: { where: { usuario_id: actorId } } },
    });
    if (!e || e.elemento_propietario.length === 0) {
      throw errorConCodigo(ForbiddenException, 'DESTINO_AJENO', 'La cuenta donde recibes debe ser tuya');
    }
    if (e.estado !== 'ACTIVO' || !RECIBEN.includes(e.categoria_funcional) || e.naturaleza === 'CUSTODIA_INFORMAL') {
      throw errorConCodigo(BadRequestException, 'CUENTA_NO_VALIDA', 'La plata se recibe en una cuenta activa');
    }
    if (moneda && e.moneda !== moneda) {
      throw errorConCodigo(BadRequestException, 'MONEDA_DISTINTA', 'La cuenta donde recibes debe estar en la moneda del gasto');
    }
    const { elemento_propietario: _, ...fila } = e;
    return fila;
  }

  /** D-2: el miembro tiene que poder transferir a la cuenta ("Que pueda transferirte" o más). */
  async #exigirVisible(cuenta: ElementoRow, usuarioId: string): Promise<void> {
    if (!(await this.elementos.puedeRecibirTransferencia(cuenta, usuarioId))) {
      throw errorConCodigo(
        BadRequestException,
        'DESTINO_NO_VISIBLE',
        'El otro miembro no puede transferir a esa cuenta: compártela al menos con "Que pueda transferirte"',
        { cuentaId: cuenta.id, usuarioId },
      );
    }
  }

  /** Un hogar donde los dos tienen membresía activa. */
  async #hogarComun(actorId: string, otroId: string): Promise<string> {
    const m = await this.prisma.membresia.findFirst({
      where: {
        usuario_id: otroId,
        estado: 'ACTIVA',
        hogar: { membresia: { some: { usuario_id: actorId, estado: 'ACTIVA' } } },
      },
      select: { hogar_id: true },
    });
    if (!m) throw errorConCodigo(BadRequestException, 'NO_ES_MIEMBRO', 'Esa persona no es de tu hogar');
    return m.hogar_id;
  }

  async #categoria(categoriaId?: string): Promise<string | null> {
    if (!categoriaId) return null;
    const c = await this.prisma.categoria_movimiento.findUnique({ where: { id: categoriaId }, select: { nombre: true } });
    return c?.nombre ?? null;
  }
}
