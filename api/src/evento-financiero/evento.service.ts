import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { toEventoDTO, type EventoFinancieroDTO } from './evento.dto.js';
import type { RegistrarEventoDto } from './dto/registrar-evento.dto.js';

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
}
