import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ProgresoService } from '../planificacion/progreso.service.js';
import { ReservaService } from '../planificacion/reserva.service.js';
import { EventoFinancieroService } from '../evento-financiero/evento.service.js';
import { errorConCodigo } from '../common/errores.js';
import type { AhorrarParaObjetivoDto } from './dto/ahorrar.dto.js';

export interface ResultadoAhorroDTO {
  objetivoId: string;
  asignacionId: string;
  destinoId: string;
  reservaId: string;
  transferenciaIds: string[];
  total: number;
  /** Progreso de la meta después de ahorrar. */
  progreso: number;
}

/** Se ahorra desde y en cuentas: no deudas, créditos ni bienes (ACTIVO). */
const NO_AHORRABLES = new Set(['DEUDA', 'CREDITO', 'ACTIVO']);

/**
 * D-1 — Ahorrar para una meta (A1, A2, A6). Un solo comando con N orígenes:
 * cada origen distinto de la cuenta de la meta se transfiere a ella y el total
 * queda ahorrado (reserva) en esa cuenta. Si el origen es la cuenta de la meta,
 * solo se reserva. Todo en una transacción; las entradas de auditoría de las
 * transferencias, la reserva y la parte creada quedan encadenadas a la del
 * comando raíz `AhorrarParaObjetivo`.
 */
@Injectable()
export class AhorroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly progreso: ProgresoService,
    private readonly reservas: ReservaService,
    private readonly eventos: EventoFinancieroService,
  ) {}

  async ahorrar(actorId: string, dto: AhorrarParaObjetivoDto): Promise<ResultadoAhorroDTO> {
    const objetivo = await this.#objetivoModificable(dto.objetivoId, actorId);

    const ids = dto.origenes.map((o) => o.elementoId);
    if (new Set(ids).size !== ids.length) {
      throw errorConCodigo(BadRequestException, 'ORIGEN_REPETIDO', 'Hay un origen repetido');
    }

    const destinoId =
      dto.destinoId ??
      (await this.cuentaDeLaMeta(objetivo.id, actorId)) ??
      (dto.origenes.length === 1 ? dto.origenes[0].elementoId : null);
    if (!destinoId) {
      throw errorConCodigo(
        BadRequestException,
        'META_SIN_CUENTA',
        'Falta destinoId: la meta aún no tiene una cuenta donde se guarde la plata',
      );
    }

    const destino = await this.#cuentaPropia(destinoId, actorId);
    for (const id of ids) {
      const origen = id === destinoId ? destino : await this.#cuentaPropia(id, actorId);
      if (origen.moneda !== destino.moneda) {
        throw errorConCodigo(
          BadRequestException,
          'MONEDA_DISTINTA',
          'Los orígenes y la cuenta de la meta deben estar en la misma moneda',
        );
      }
    }
    if (destino.moneda !== objetivo.moneda) {
      throw errorConCodigo(
        BadRequestException,
        'MONEDA_DISTINTA',
        'La cuenta de la meta debe estar en la moneda de la meta',
      );
    }

    const fecha = dto.fecha ?? new Date().toISOString().slice(0, 10);
    const total = dto.origenes.reduce((s, o) => s + o.monto, 0);

    return this.prisma.$transaction(async (tx) => {
      const raizId = await this.auditoria.registrar(tx, {
        comando: 'AhorrarParaObjetivo',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: objetivo.id,
        valorPosterior: {
          destino_id: destinoId,
          total,
          origenes: dto.origenes.map((o) => ({ elemento_id: o.elementoId, monto: o.monto })),
        },
      });

      const asignacionId = await this.#asignacion(tx, objetivo, dto.asignacionId, actorId, raizId);

      const transferenciaIds: string[] = [];
      for (const o of dto.origenes) {
        if (o.elementoId === destinoId) continue;
        // Solo se mueve lo libre: la plata que ya está en otra meta no se toca.
        const libre = await this.progreso.disponibilidad(o.elementoId, tx);
        if (o.monto > libre + 1e-9) {
          throw errorConCodigo(
            ConflictException,
            'DISPONIBLE_INSUFICIENTE',
            `El elemento solo tiene ${libre} disponible (pediste ${o.monto})`,
            { disponible: libre, pedido: o.monto, elementoId: o.elementoId },
          );
        }
        const ev = await this.eventos.registrarEventoEnTx(
          tx,
          actorId,
          {
            tipo: 'TRANSFERENCIA',
            monto: o.monto,
            moneda: destino.moneda,
            fecha,
            elementoOrigenId: o.elementoId,
            elementoDestinoId: destinoId,
            glosa: `Ahorro para ${objetivo.nombre}`,
          },
          { encadenadaDeId: raizId },
        );
        transferenciaIds.push(ev.id);
      }

      const reserva = await this.reservas.crearEnTx(
        tx,
        actorId,
        { asignacionId, elementoOrigenId: destinoId, monto: total },
        { encadenadaDeId: raizId },
      );

      return {
        objetivoId: objetivo.id,
        asignacionId,
        destinoId,
        reservaId: reserva.id,
        transferenciaIds,
        total,
        progreso: await this.progreso.progresoDeObjetivo(objetivo.id, tx),
      };
    });
  }

  /**
   * La cuenta de la meta (D-1, no se persiste): la cuenta propia y activa con
   * más plata ahorrada en la meta. `null` si aún no hay ninguna.
   */
  async cuentaDeLaMeta(objetivoId: string, actorId: string): Promise<string | null> {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        estado: 'ACTIVA',
        asignacion: { objetivo_financiero_id: objetivoId },
        elemento_patrimonial: {
          estado: 'ACTIVO',
          elemento_propietario: { some: { usuario_id: actorId } },
        },
      },
      select: { elemento_origen_id: true, monto: true },
    });
    const porCuenta = new Map<string, number>();
    for (const r of reservas) {
      porCuenta.set(r.elemento_origen_id, (porCuenta.get(r.elemento_origen_id) ?? 0) + Number(r.monto));
    }
    let mejor: string | null = null;
    for (const [id, monto] of porCuenta) {
      if (mejor === null || monto > (porCuenta.get(mejor) ?? 0)) mejor = id;
    }
    return mejor;
  }

  /** Lo libre para ahorrar de cada cuenta propia y activa (valor − reservas activas). */
  async disponibilidades(actorId: string): Promise<{ elementoId: string; disponible: number }[]> {
    const els = await this.prisma.elemento_patrimonial.findMany({
      where: {
        estado: 'ACTIVO',
        categoria_funcional: { notIn: [...NO_AHORRABLES] },
        elemento_propietario: { some: { usuario_id: actorId } },
      },
      select: { id: true },
    });
    return Promise.all(
      els.map(async (e) => ({ elementoId: e.id, disponible: await this.progreso.disponibilidad(e.id) })),
    );
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /** La parte indicada, la más antigua de la meta o una nueva con su nombre. */
  async #asignacion(
    tx: Prisma.TransactionClient,
    objetivo: { id: string; nombre: string },
    asignacionId: string | undefined,
    actorId: string,
    raizId: string,
  ): Promise<string> {
    if (asignacionId) {
      const a = await tx.asignacion.findUnique({ where: { id: asignacionId } });
      if (!a || a.objetivo_financiero_id !== objetivo.id) {
        throw errorConCodigo(NotFoundException, 'ASIGNACION_NO_ENCONTRADA', 'Asignación no encontrada');
      }
      return a.id;
    }
    const existente = await tx.asignacion.findFirst({
      where: { objetivo_financiero_id: objetivo.id },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });
    if (existente) return existente.id;
    const creada = await tx.asignacion.create({
      data: { nombre: objetivo.nombre, objetivo_financiero_id: objetivo.id, usuario_id: actorId },
    });
    await this.auditoria.registrar(tx, {
      comando: 'CrearAsignacion',
      usuarioId: actorId,
      entidadTipo: 'ASIGNACION',
      entidadId: creada.id,
      valorPosterior: { nombre: creada.nombre, objetivo_financiero_id: objetivo.id },
      encadenadaDeId: raizId,
    });
    return creada.id;
  }

  async #objetivoModificable(objetivoId: string, actorId: string) {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!o) throw errorConCodigo(NotFoundException, 'OBJETIVO_NO_ENCONTRADO', 'Objetivo no encontrado');
    if (o.usuario_id === actorId) return o;
    if (o.hogar_id) {
      const d = await this.prisma.objetivo_designado.findUnique({
        where: { objetivo_id_usuario_id: { objetivo_id: o.id, usuario_id: actorId } },
      });
      if (d) return o;
    }
    throw errorConCodigo(ForbiddenException, 'OBJETIVO_NO_MODIFICABLE', 'No puedes modificar este objetivo');
  }

  async #cuentaPropia(elementoId: string, actorId: string) {
    const e = await this.prisma.elemento_patrimonial.findUnique({
      where: { id: elementoId },
      include: { elemento_propietario: { where: { usuario_id: actorId } } },
    });
    if (!e || e.elemento_propietario.length === 0) {
      throw errorConCodigo(ForbiddenException, 'ORIGEN_AJENO', 'No eres propietario del elemento');
    }
    if (e.estado !== 'ACTIVO' || NO_AHORRABLES.has(e.categoria_funcional)) {
      throw new BadRequestException('Solo se puede ahorrar desde y en cuentas activas');
    }
    return e;
  }
}
