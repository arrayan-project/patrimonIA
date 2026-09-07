import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgresoService } from '../planificacion/progreso.service.js';
import { ConversionService } from '../tipo-cambio/conversion.service.js';
import {
  type EventoConsolidadoDTO,
  type MetricasHogarDTO,
  type PatrimonioConsolidadoDTO,
} from './consolidacion.dto.js';

const CATEGORIAS_PASIVO = ['DEUDA'];

/**
 * Consolidación Patrimonial (DDD Sección Q): vista agregada del patrimonio de un
 * hogar. NO crea ni transforma patrimonio — solo agrega elementos existentes con
 * `participa_consolidacion = true`. Cálculo EN VIVO (Principio 1).
 *
 * Sin tipos de cambio (GAPS.md G7): el desglose es por moneda, sin total único.
 * Sin columna `hogar_id` en elemento (GAPS.md G19): un elemento con
 * `participa_consolidacion` entra en la consolidación de todo hogar donde alguno
 * de sus propietarios sea miembro ACTIVA.
 */
@Injectable()
export class ConsolidacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progreso: ProgresoService,
    private readonly conversion: ConversionService,
  ) {}

  async patrimonioConsolidado(
    hogarId: string,
    actorId: string,
  ): Promise<PatrimonioConsolidadoDTO> {
    const hogar = await this.#exigirMiembro(hogarId, actorId);
    const miembros = await this.#miembrosActivos(hogarId);
    const elementos = await this.#elementosConsolidados(miembros);

    const acc = new Map<
      string,
      { neto: Prisma.Decimal; activos: Prisma.Decimal; pasivos: Prisma.Decimal; liquido: Prisma.Decimal }
    >();
    for (const el of elementos) {
      const v = new Prisma.Decimal(el.valor_vigente);
      const cur =
        acc.get(el.moneda) ??
        {
          neto: new Prisma.Decimal(0),
          activos: new Prisma.Decimal(0),
          pasivos: new Prisma.Decimal(0),
          liquido: new Prisma.Decimal(0),
        };
      cur.neto = cur.neto.plus(v);
      if (CATEGORIAS_PASIVO.includes(el.categoria_funcional)) cur.pasivos = cur.pasivos.plus(v.abs());
      else cur.activos = cur.activos.plus(v);
      if (el.participa_valor_liquido) cur.liquido = cur.liquido.plus(v);
      acc.set(el.moneda, cur);
    }

    const porMoneda = [...acc.entries()]
      .map(([moneda, v]) => ({
        moneda,
        patrimonioNeto: v.neto.toNumber(),
        activos: v.activos.toNumber(),
        pasivos: v.pasivos.toNumber(),
        valorLiquido: v.liquido.toNumber(),
      }))
      .sort((a, b) => a.moneda.localeCompare(b.moneda));

    const destino = hogar.moneda_consolidacion;
    const hoy = new Date();
    let total = new Prisma.Decimal(0);
    const conversionesFaltantes: string[] = [];
    for (const [moneda, v] of acc.entries()) {
      if (await this.conversion.disponible(moneda, destino, hoy)) {
        total = total.plus(await this.conversion.convertir(v.neto, moneda, destino, hoy));
      } else {
        conversionesFaltantes.push(moneda);
      }
    }

    return {
      hogarId,
      monedaConsolidacion: destino,
      elementos: elementos.length,
      miembros: miembros.length,
      porMoneda,
      total: conversionesFaltantes.length > 0 ? null : total.toNumber(),
      conversionesFaltantes,
    };
  }

  async metricas(hogarId: string, actorId: string): Promise<MetricasHogarDTO> {
    await this.#exigirMiembro(hogarId, actorId);
    const miembros = await this.#miembrosActivos(hogarId);
    const elementos = await this.#elementosConsolidados(miembros);

    const porMonedaMap = new Map<string, ElementoRow[]>();
    for (const el of elementos) {
      const arr = porMonedaMap.get(el.moneda) ?? [];
      arr.push(el);
      porMonedaMap.set(el.moneda, arr);
    }

    const porMoneda = [...porMonedaMap.entries()]
      .map(([moneda, els]) => {
        let activos = new Prisma.Decimal(0);
        let pasivos = new Prisma.Decimal(0);
        let liquido = new Prisma.Decimal(0);
        const activoPorCat = new Map<string, Prisma.Decimal>();
        const pasivoPorCat = new Map<string, Prisma.Decimal>();
        for (const el of els) {
          const v = new Prisma.Decimal(el.valor_vigente);
          if (CATEGORIAS_PASIVO.includes(el.categoria_funcional)) {
            pasivos = pasivos.plus(v.abs());
            pasivoPorCat.set(
              el.categoria_funcional,
              (pasivoPorCat.get(el.categoria_funcional) ?? new Prisma.Decimal(0)).plus(v.abs()),
            );
          } else {
            activos = activos.plus(v);
            activoPorCat.set(
              el.categoria_funcional,
              (activoPorCat.get(el.categoria_funcional) ?? new Prisma.Decimal(0)).plus(v),
            );
          }
          if (el.participa_valor_liquido) liquido = liquido.plus(v);
        }
        const dist = (m: Map<string, Prisma.Decimal>, total: Prisma.Decimal) =>
          [...m.entries()]
            .map(([categoria, valor]) => ({
              categoria,
              valor: valor.toNumber(),
              porcentaje: total.isZero()
                ? 0
                : Math.round(valor.dividedBy(total).times(1000).toNumber()) / 10,
            }))
            .sort((a, b) => b.valor - a.valor);
        return {
          moneda,
          patrimonioNeto: activos.minus(pasivos).toNumber(),
          activos: activos.toNumber(),
          pasivos: pasivos.toNumber(),
          liquidez: activos.isZero() ? null : Math.round(liquido.dividedBy(activos).toNumber() * 1000) / 1000,
          distribucionPorActivo: dist(activoPorCat, activos),
          distribucionPorPasivo: dist(pasivoPorCat, pasivos),
        };
      })
      .sort((a, b) => a.moneda.localeCompare(b.moneda));

    const objetivos = await this.prisma.objetivo_financiero.findMany({
      where: { usuario_id: { in: miembros } },
    });
    let progresoTotal = 0;
    let montoObjetivoTotal = 0;
    for (const o of objetivos) {
      progresoTotal += await this.progreso.progresoDeObjetivo(o.id);
      montoObjetivoTotal += Number(o.monto_objetivo);
    }

    return {
      hogarId,
      porMoneda,
      objetivos: {
        total: objetivos.length,
        enProgreso: objetivos.filter((o) => o.estado === 'EN_PROGRESO').length,
        completados: objetivos.filter((o) => o.estado === 'COMPLETADO').length,
        montoObjetivoTotal,
        progresoTotal,
        avancePorcentaje:
          montoObjetivoTotal === 0
            ? null
            : Math.round((progresoTotal / montoObjetivoTotal) * 1000) / 10,
      },
    };
  }

  /**
   * Vista consolidada de eventos del hogar (REQUISITES §K): una fila por evento
   * (colapsa las 2+ patas de una transferencia) con el monto neto tras las
   * correcciones vivas (colapsa el par original+compensatorio).
   */
  async eventosDelHogar(hogarId: string, actorId: string): Promise<EventoConsolidadoDTO[]> {
    await this.#exigirMiembro(hogarId, actorId);
    const miembros = await this.#miembrosActivos(hogarId);
    const props = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: { in: miembros } },
      select: { elemento_id: true, usuario_id: true },
    });
    const propiosDelActor = new Set(
      props.filter((p) => p.usuario_id === actorId).map((p) => p.elemento_id),
    );
    const elementosDelHogar = await this.prisma.elemento_patrimonial.findMany({
      where: { id: { in: [...new Set(props.map((p) => p.elemento_id))] } },
      select: { id: true, nombre: true, participa_consolidacion: true },
    });
    const nombrePorId = new Map(elementosDelHogar.map((e) => [e.id, e.nombre]));
    // §M — el actor solo ve eventos que tocan un elemento consolidado del hogar
    // o de su propiedad; los movimientos privados de otros miembros no se filtran.
    const elementoIds = elementosDelHogar
      .filter((e) => e.participa_consolidacion || propiosDelActor.has(e.id))
      .map((e) => e.id);

    const impactosDelHogar = await this.prisma.impacto_patrimonial.findMany({
      where: { elemento_id: { in: elementoIds }, origen_tipo: 'EVENTO_FINANCIERO' },
      select: { origen_id: true },
    });
    // Todos los impactos de estos eventos (incluidos los de los compensatorios),
    // para poder recuperar el delta de cada corrección.
    const eventoIdsBase = [...new Set(impactosDelHogar.map((i) => i.origen_id))];
    const eventos = await this.prisma.evento_financiero.findMany({
      where: {
        OR: [{ id: { in: eventoIdsBase } }, { correccion_de_id: { in: eventoIdsBase } }],
      },
    });
    const todosLosImpactos = await this.prisma.impacto_patrimonial.findMany({
      where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: { in: eventos.map((e) => e.id) } },
    });
    const primerImpacto = (eventoId: string) =>
      todosLosImpactos.find((i) => i.origen_id === eventoId) ?? null;

    // delta neto de la corrección viva de cada evento raíz
    const deltaPorRaiz = new Map<string, number>();
    for (const c of eventos) {
      if (!c.correccion_de_id || c.anulado) continue;
      const impRaiz = primerImpacto(c.correccion_de_id);
      const impComp = primerImpacto(c.id);
      if (!impRaiz || !impComp) continue;
      const signo = Number(impRaiz.monto) >= 0 ? 1 : -1; // signo del impacto original
      const delta = Number(impComp.monto) * signo; // compImpacto = delta * signo  ⇒  delta = comp * signo
      deltaPorRaiz.set(c.correccion_de_id, (deltaPorRaiz.get(c.correccion_de_id) ?? 0) + delta);
    }

    const filas: EventoConsolidadoDTO[] = [];
    for (const e of eventos) {
      if (e.correccion_de_id) continue; // el compensatorio se pliega en su raíz
      if (!eventoIdsBase.includes(e.id)) continue;
      const delta = deltaPorRaiz.get(e.id) ?? 0;
      const elementosDelEvento = [
        ...new Set(todosLosImpactos.filter((i) => i.origen_id === e.id).map((i) => i.elemento_id)),
      ];
      filas.push({
        eventoId: e.id,
        tipo: e.tipo,
        fecha: e.fecha.toISOString().slice(0, 10),
        moneda: e.moneda,
        montoEfectivo: Number(e.monto) + delta,
        anulado: e.anulado,
        corregido: deltaPorRaiz.has(e.id),
        glosa: e.glosa,
        elementos: elementosDelEvento
          .filter((id) => nombrePorId.has(id))
          .map((id) => ({ id, nombre: nombrePorId.get(id) as string })),
      });
    }
    return filas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #exigirMiembro(hogarId: string, actorId: string) {
    const hogar = await this.prisma.hogar.findUnique({ where: { id: hogarId } });
    if (!hogar) throw new NotFoundException('Hogar no encontrado');
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!m) throw new ForbiddenException('No eres miembro activo de ese hogar');
    return hogar;
  }

  async #miembrosActivos(hogarId: string): Promise<string[]> {
    const ms = await this.prisma.membresia.findMany({
      where: { hogar_id: hogarId, estado: 'ACTIVA' },
      select: { usuario_id: true },
    });
    return ms.map((m) => m.usuario_id);
  }

  /** Elementos ACTIVOS con participa_consolidacion, de propietarios miembros, sin duplicar. */
  async #elementosConsolidados(miembros: string[]): Promise<ElementoRow[]> {
    const props = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: { in: miembros } },
      select: { elemento_id: true },
    });
    const ids = [...new Set(props.map((p) => p.elemento_id))];
    return this.prisma.elemento_patrimonial.findMany({
      where: { id: { in: ids }, estado: 'ACTIVO', participa_consolidacion: true },
    });
  }
}
