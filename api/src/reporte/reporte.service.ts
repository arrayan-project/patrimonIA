import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AlcanceReporte,
  MovimientoReporteDTO,
  ResumenAnualDTO,
  ResumenFinancieroDTO,
  RubroReporteDTO,
  TotalesPorMoneda,
} from './reporte.dto.js';

interface MovimientoInterno {
  eventoId: string;
  fecha: string;
  tipo: string;
  monto: number;
  moneda: string;
  categoriaId: string | null;
  glosa: string | null;
  corregido: boolean;
  /** Solo TRANSFERENCIA/CONVERSION: efecto neto sobre las cuentas del actor. NULL en el resto. */
  efectoPropio: number | null;
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  registradoEn: string;
  contraparte: { usuarioId: string; nombre: string } | null;
}

/**
 * Reportes financieros (proyección de lectura, no dominio): agrega los eventos
 * INGRESO / GASTO que ya existen sobre una ventana de fechas, para las vistas de
 * "movimientos del mes / del año". No inventa reglas — colapsa las correcciones
 * vivas igual que `GET /hogares/:id/eventos-financieros` y no convierte monedas
 * (GAPS.md G7/G16). Ver GAPS.md G27.
 */
@Injectable()
export class ReporteService {
  constructor(private readonly prisma: PrismaService) {}

  async resumenPeriodo(
    actorId: string,
    desdeISO: string,
    hastaISO: string,
    alcance: AlcanceReporte,
    hogarId?: string,
  ): Promise<ResumenFinancieroDTO> {
    const desde = this.#fecha(desdeISO);
    const hasta = this.#fecha(hastaISO);
    if (hasta < desde) throw new BadRequestException('hasta es anterior a desde');

    const elementoIds = await this.#elementosEnAlcance(actorId, alcance, hogarId);
    const movs = await this.#movimientosDelPeriodo(elementoIds, desde, hasta);

    const etiquetasPorEvento = await this.#etiquetasPorEvento(movs.map((m) => m.eventoId));
    const categorias = await this.#categorias(movs.map((m) => m.categoriaId));

    const porMoneda = this.#totalesPorMoneda(movs);

    // porRubro: (categoriaId | null, tipo) → total. SALDO_INICIAL entra como un
    // rubro de ingreso propio ("Saldo inicial"); las transferencias no.
    const acc = new Map<string, RubroReporteDTO>();
    for (const m of movs) {
      if (m.tipo !== 'INGRESO' && m.tipo !== 'GASTO' && m.tipo !== 'SALDO_INICIAL') continue;
      const esSaldo = m.tipo === 'SALDO_INICIAL';
      const tipo: 'INGRESO' | 'GASTO' = m.tipo === 'GASTO' ? 'GASTO' : 'INGRESO';
      const key = esSaldo ? 'saldo-inicial|INGRESO' : `${m.categoriaId ?? '∅'}|${tipo}`;
      const cat = m.categoriaId ? categorias.get(m.categoriaId) : null;
      const fila =
        acc.get(key) ??
        ({
          categoriaId: esSaldo ? null : m.categoriaId,
          nombre: esSaldo ? 'Saldo inicial' : (cat?.nombre ?? 'Sin clasificar'),
          color: cat?.color ?? null,
          tipo,
          total: 0,
        } as RubroReporteDTO);
      fila.total += m.monto;
      acc.set(key, fila);
    }
    const porRubro = [...acc.values()].sort((a, b) => b.total - a.total);

    return {
      periodo: { desde: desdeISO.slice(0, 10), hasta: hastaISO.slice(0, 10) },
      alcance,
      porMoneda,
      porRubro,
      movimientos: movs.map(
        (m): MovimientoReporteDTO => ({
          eventoId: m.eventoId,
          fecha: m.fecha,
          tipo: m.tipo,
          monto: m.monto,
          moneda: m.moneda,
          glosa: m.glosa,
          categoriaId: m.categoriaId,
          etiquetaIds: etiquetasPorEvento.get(m.eventoId) ?? [],
          corregido: m.corregido,
          efectoPropio: m.efectoPropio,
          elementoOrigenId: m.elementoOrigenId,
          elementoDestinoId: m.elementoDestinoId,
          registradoEn: m.registradoEn,
          contraparte: m.contraparte,
        }),
      ),
    };
  }

  async resumenAnual(
    actorId: string,
    anio: number,
    alcance: AlcanceReporte,
    hogarId?: string,
  ): Promise<ResumenAnualDTO> {
    if (anio < 2000 || anio > 2100) throw new BadRequestException('Año fuera de rango');
    const desde = new Date(Date.UTC(anio, 0, 1));
    const hasta = new Date(Date.UTC(anio, 11, 31));

    const elementoIds = await this.#elementosEnAlcance(actorId, alcance, hogarId);
    const movs = await this.#movimientosDelPeriodo(elementoIds, desde, hasta);

    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      porMoneda: this.#totalesPorMoneda(
        movs.filter((m) => Number(m.fecha.slice(5, 7)) === i + 1),
      ),
    }));

    return { anio, alcance, meses };
  }

  // ── Núcleo ────────────────────────────────────────────────────────────────

  /**
   * Movimientos de la ventana con el monto neto de correcciones. Incluye
   * TRANSFERENCIA/CONVERSION como filas neutras (no cuentan para ingreso/gasto —
   * ver `#totalesPorMoneda` y el bucle de `porRubro`); llevan `efectoPropio` con
   * el impacto sobre las cuentas del actor.
   */
  async #movimientosDelPeriodo(
    elementoIds: string[],
    desde: Date,
    hasta: Date,
  ): Promise<MovimientoInterno[]> {
    if (elementoIds.length === 0) return [];

    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { elemento_id: { in: elementoIds }, origen_tipo: 'EVENTO_FINANCIERO' },
      select: { origen_id: true },
    });
    const eventoIdsBase = [...new Set(impactos.map((i) => i.origen_id))];
    if (eventoIdsBase.length === 0) return [];

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

    // delta neto de la corrección viva de cada evento raíz (igual que eventosDelHogar)
    const deltaPorRaiz = new Map<string, number>();
    for (const c of eventos) {
      if (!c.correccion_de_id || c.anulado) continue;
      const impRaiz = primerImpacto(c.correccion_de_id);
      const impComp = primerImpacto(c.id);
      if (!impRaiz || !impComp) continue;
      const signo = Number(impRaiz.monto) >= 0 ? 1 : -1;
      const delta = Number(impComp.monto) * signo;
      deltaPorRaiz.set(c.correccion_de_id, (deltaPorRaiz.get(c.correccion_de_id) ?? 0) + delta);
    }

    const propios = new Set(elementoIds);
    const esInterno = (tipo: string) => tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION';

    // G39 (claridad): en una transferencia con alguien de fuera del alcance (otro
    // miembro del hogar), quién es: el dueño de la cuenta del otro lado.
    const ajenas = [
      ...new Set(
        todosLosImpactos
          .filter((i) => !propios.has(i.elemento_id) && eventos.some((e) => e.id === i.origen_id && esInterno(e.tipo)))
          .map((i) => i.elemento_id),
      ),
    ];
    const duenos = ajenas.length
      ? await this.prisma.elemento_propietario.findMany({
          where: { elemento_id: { in: ajenas } },
          select: { elemento_id: true, usuario: { select: { id: true, nombre: true } } },
        })
      : [];
    const duenoDe = new Map<string, { usuarioId: string; nombre: string }>();
    for (const d of duenos) {
      if (!duenoDe.has(d.elemento_id)) duenoDe.set(d.elemento_id, { usuarioId: d.usuario.id, nombre: d.usuario.nombre });
    }

    const filas: MovimientoInterno[] = [];
    for (const e of eventos) {
      if (e.correccion_de_id) continue; // el compensatorio se pliega en su raíz
      if (!eventoIdsBase.includes(e.id)) continue;
      if (e.anulado) continue;
      if (e.fecha < desde || e.fecha > hasta) continue;
      const delta = deltaPorRaiz.get(e.id) ?? 0;
      const efectoPropio = esInterno(e.tipo)
        ? todosLosImpactos
            .filter((i) => i.origen_id === e.id && propios.has(i.elemento_id))
            .reduce((s, i) => s + Number(i.monto), 0)
        : null;
      // G39: la cuenta de donde salió (impacto negativo) y a donde llegó (positivo).
      const propiosDelEvento = todosLosImpactos.filter((i) => i.origen_id === e.id);
      const origen = propiosDelEvento.find((i) => Number(i.monto) < 0);
      const destino = propiosDelEvento.find((i) => Number(i.monto) > 0);
      filas.push({
        eventoId: e.id,
        fecha: e.fecha.toISOString().slice(0, 10),
        tipo: e.tipo,
        monto: Number(e.monto) + delta,
        moneda: e.moneda,
        categoriaId: e.categoria_id,
        glosa: e.glosa,
        corregido: deltaPorRaiz.has(e.id),
        efectoPropio,
        elementoOrigenId: origen?.elemento_id ?? null,
        elementoDestinoId: destino?.elemento_id ?? null,
        registradoEn: e.created_at.toISOString(),
        contraparte: esInterno(e.tipo)
          ? (propiosDelEvento.map((i) => !propios.has(i.elemento_id) && duenoDe.get(i.elemento_id)).find(Boolean) || null)
          : null,
      });
    }
    return filas.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  #totalesPorMoneda(movs: MovimientoInterno[]): TotalesPorMoneda[] {
    const acc = new Map<string, { ingresos: number; gastos: number }>();
    for (const m of movs) {
      // TRANSFERENCIA/CONVERSION son neutras: no crean fila de moneda ni suman.
      // SALDO_INICIAL (apertura de cuenta) cuenta como ingreso del período (§G29).
      if (m.tipo !== 'INGRESO' && m.tipo !== 'GASTO' && m.tipo !== 'SALDO_INICIAL') continue;
      const cur = acc.get(m.moneda) ?? { ingresos: 0, gastos: 0 };
      if (m.tipo === 'GASTO') cur.gastos += m.monto;
      else cur.ingresos += m.monto;
      acc.set(m.moneda, cur);
    }
    return [...acc.entries()]
      .map(([moneda, v]) => ({
        moneda,
        ingresos: v.ingresos,
        gastos: v.gastos,
        balance: v.ingresos - v.gastos,
      }))
      .sort((a, b) => a.moneda.localeCompare(b.moneda));
  }

  // ── Alcance y catálogos ───────────────────────────────────────────────────

  async #elementosEnAlcance(
    actorId: string,
    alcance: AlcanceReporte,
    hogarId?: string,
  ): Promise<string[]> {
    let usuarioIds: string[];
    if (alcance === 'hogar') {
      if (!hogarId) throw new BadRequestException('El alcance "hogar" requiere hogarId');
      const miembro = await this.prisma.membresia.findFirst({
        where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
      });
      if (!miembro) throw new ForbiddenException('No eres miembro activo de ese hogar');
      usuarioIds = (
        await this.prisma.membresia.findMany({
          where: { hogar_id: hogarId, estado: 'ACTIVA' },
          select: { usuario_id: true },
        })
      ).map((m) => m.usuario_id);
    } else {
      usuarioIds = [actorId];
    }
    const props = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: { in: usuarioIds } },
      select: { elemento_id: true },
    });
    return [...new Set(props.map((p) => p.elemento_id))];
  }

  async #categorias(ids: (string | null)[]) {
    const reales = [...new Set(ids.filter((x): x is string => x !== null))];
    const mapa = new Map<string, { nombre: string; color: string | null }>();
    if (reales.length === 0) return mapa;
    const filas = await this.prisma.categoria_movimiento.findMany({ where: { id: { in: reales } } });
    for (const c of filas) mapa.set(c.id, { nombre: c.nombre, color: c.color });
    return mapa;
  }

  async #etiquetasPorEvento(eventoIds: string[]): Promise<Map<string, string[]>> {
    const mapa = new Map<string, string[]>();
    if (eventoIds.length === 0) return mapa;
    const filas = await this.prisma.evento_etiqueta.findMany({
      where: { evento_id: { in: eventoIds } },
    });
    for (const f of filas) {
      mapa.set(f.evento_id, [...(mapa.get(f.evento_id) ?? []), f.etiqueta_id]);
    }
    return mapa;
  }

  #fecha(iso: string): Date {
    return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  }
}
