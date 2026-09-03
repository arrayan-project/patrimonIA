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

    const plan = await this.planImpactos(actorId, dto, moneda, monto);

    const { evento, impactos } = await this.prisma.$transaction(async (tx) => {
      const evento = await tx.evento_financiero.create({
        data: { tipo: dto.tipo, monto, moneda, fecha, anulado: false },
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
            },
          }),
        );
        await tx.elemento_patrimonial.update({
          where: { id: p.elemento.id },
          data: { valor_vigente: new Prisma.Decimal(p.elemento.valor_vigente).plus(p.monto) },
        });
      }

      await this.auditoria.registrar(tx, {
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
        },
      });

      return { evento, impactos };
    });

    return toEventoDTO(evento, impactos);
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
      }

      const actualizado = await tx.evento_financiero.update({
        where: { id: evento.id },
        data: { anulado: true },
      });

      await this.auditoria.registrar(tx, {
        comando: 'AnularEventoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'EVENTO_FINANCIERO',
        entidadId: evento.id,
        motivo: dto.motivo,
        valorAnterior: { anulado: false },
        valorPosterior: { anulado: true },
      });

      return actualizado;
    });

    return toEventoDTO(anulado, impactos);
  }

  /**
   * AS #12 — CorregirEventoFinanciero. Patrón de corrección (DDD Sección T): el
   * evento original permanece intacto e inmutable; se INSERTA un evento
   * compensatorio con `correccion_de_id` apuntando al original. En Evento
   * Financiero la corrección **compensa montos** (flujo): impacto = signo del
   * impacto original × (nuevoMonto − montoOriginal).
   * Fase 3 corrige solo el monto — tipo/fecha/elementos requieren anular + registrar.
   * Auditoría: Corrección — evento original, evento compensatorio, motivo.
   */
  async corregirEvento(actorId: string, dto: CorregirEventoDto): Promise<EventoFinancieroDTO> {
    const { evento, impactos } = await this.exigirAccesoEvento(dto.eventoId, actorId);
    if (evento.anulado) throw new ConflictException('No se puede corregir un evento anulado');
    if (await this.tieneCorreccionViva(evento.id)) {
      throw new ConflictException('El evento ya tiene una corrección — corrige esa última');
    }

    const nuevoMonto = new Prisma.Decimal(dto.nuevoMonto);
    const delta = nuevoMonto.minus(evento.monto); // p.ej. 45.000 − 50.000 = −5.000
    if (delta.isZero()) {
      throw new BadRequestException('El nuevo monto es igual al actual — no hay nada que corregir');
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const compensatorio = await tx.evento_financiero.create({
        data: {
          tipo: evento.tipo,
          monto: delta.abs(),
          moneda: evento.moneda,
          fecha: evento.fecha,
          correccion_de_id: evento.id,
          anulado: false,
        },
      });

      const nuevosImpactos = [];
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
            },
          }),
        );
        const el = await tx.elemento_patrimonial.findUniqueOrThrow({ where: { id: i.elemento_id } });
        await tx.elemento_patrimonial.update({
          where: { id: i.elemento_id },
          data: { valor_vigente: new Prisma.Decimal(el.valor_vigente).plus(montoComp) },
        });
      }

      await this.auditoria.registrar(tx, {
        comando: 'CorregirEventoFinanciero',
        usuarioId: actorId,
        entidadTipo: 'EVENTO_FINANCIERO',
        entidadId: evento.id,
        motivo: dto.motivo,
        valorAnterior: { monto: evento.monto.toNumber() },
        valorPosterior: { monto: nuevoMonto.toNumber() },
        entidadRelacionadaTipo: 'EVENTO_FINANCIERO',
        entidadRelacionadaId: compensatorio.id,
      });

      return { compensatorio, nuevosImpactos };
    });

    return toEventoDTO(resultado.compensatorio, resultado.nuevosImpactos);
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
    return toEventoDTO(evento, impactos);
  }

  async listarPorElemento(elementoId: string, actorId: string): Promise<EventoFinancieroDTO[]> {
    await this.exigirPropietario(elementoId, actorId);
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
    return eventos.map((e) => toEventoDTO(e, impactosPorEvento.get(e.id) ?? []));
  }

  // ── Armado y validación del plan de impactos ──────────────────────────────

  private async planImpactos(
    actorId: string,
    dto: RegistrarEventoDto,
    moneda: string,
    monto: Prisma.Decimal,
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

    // TRANSFERENCIA
    if (!dto.elementoOrigenId || !dto.elementoDestinoId) {
      throw new BadRequestException('TRANSFERENCIA requiere elementoOrigenId y elementoDestinoId');
    }
    if (dto.elementoOrigenId === dto.elementoDestinoId) {
      throw new BadRequestException('Origen y destino no pueden ser el mismo elemento');
    }
    const origen = await cargar(dto.elementoOrigenId);
    const destino = await cargar(dto.elementoDestinoId);
    await this.exigirPropietario(origen.id, actorId); // solo mueves plata de lo tuyo
    if (origen.moneda !== destino.moneda) {
      throw new BadRequestException('Transferencia entre monedas distintas es una CONVERSION (no soportada aún)');
    }
    this.exigirMoneda(origen, moneda);
    if (!(await this.actorPuedeRecibirEn(destino, actorId))) {
      throw new ForbiddenException('No puedes transferir a ese elemento destino');
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

  /** ¿Hay una corrección no-anulada apuntando a este evento? */
  private async tieneCorreccionViva(eventoId: string): Promise<boolean> {
    const corr = await this.prisma.evento_financiero.findFirst({
      where: { correccion_de_id: eventoId, anulado: false },
    });
    return corr !== null;
  }
}
