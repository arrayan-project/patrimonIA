import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AlcanceReporte,
  FotoMesDTO,
  FotoMesPorMonedaDTO,
  LineaFotoMesDTO,
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
    cuentas?: string[],
  ): Promise<ResumenFinancieroDTO> {
    const desde = this.#fecha(desdeISO);
    const hasta = this.#fecha(hastaISO);
    if (hasta < desde) throw new BadRequestException('hasta es anterior a desde');

    // G42: en "Lo mío", solo las cuentas del día a día que se pidan.
    let elementoIds = await this.#elementosEnAlcance(actorId, alcance, hogarId);
    if (cuentas && alcance === 'mios') elementoIds = elementoIds.filter((id) => cuentas.includes(id));
    const movs = await this.#movimientosDelPeriodo(elementoIds, desde, hasta, actorId);

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
    const movs = await this.#movimientosDelPeriodo(elementoIds, desde, hasta, actorId);

    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      porMoneda: this.#totalesPorMoneda(
        movs.filter((m) => Number(m.fecha.slice(5, 7)) === i + 1),
      ),
    }));

    return { anio, alcance, meses };
  }

  /**
   * G41 — la foto del mes de un grupo de cuentas (las del día a día, G42): lo
   * que había al empezar, qué la movió y lo que había al terminar, por moneda.
   * Cuadra por construcción: el saldo a una fecha es `valor_vigente` menos los
   * impactos vivos posteriores (como `ReconstruccionService`), y las líneas son
   * los impactos vivos de la ventana. Pagar la tarjeta, si la tarjeta está en
   * el grupo, es plata entre tus cuentas: no suma ni resta (la compra ya contó
   * como gasto el día que se hizo).
   */
  async fotoMes(actorId: string, desdeISO: string, hastaISO: string, cuentas?: string[]): Promise<FotoMesDTO> {
    const desde = this.#fecha(desdeISO);
    const hasta = this.#fecha(hastaISO);
    if (hasta < desde) throw new BadRequestException('hasta es anterior a desde');

    const mias = await this.#elementosEnAlcance(actorId, 'mios');
    const els = await this.prisma.elemento_patrimonial.findMany({
      where: { id: { in: cuentas ? mias.filter((id) => cuentas.includes(id)) : mias }, estado: 'ACTIVO' },
      select: { id: true, moneda: true, valor_vigente: true },
    });
    const enGrupo = new Map(els.map((e) => [e.id, e]));
    const ids = [...enGrupo.keys()];

    const impactos = ids.length
      ? await this.prisma.impacto_patrimonial.findMany({ where: { elemento_id: { in: ids }, fecha: { gte: desde } } })
      : [];
    const eventoIds = [...new Set(impactos.filter((i) => i.origen_tipo === 'EVENTO_FINANCIERO').map((i) => i.origen_id))];
    const eventos = eventoIds.length
      ? await this.prisma.evento_financiero.findMany({
          where: { id: { in: eventoIds } },
          select: { id: true, tipo: true, anulado: true, correccion_de_id: true },
        })
      : [];
    const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
    // Una corrección se clasifica como su movimiento original.
    const raizIds = [...new Set(eventos.map((e) => e.correccion_de_id).filter((x): x is string => !!x))];
    const raices = raizIds.length
      ? await this.prisma.evento_financiero.findMany({ where: { id: { in: raizIds } }, select: { id: true, tipo: true } })
      : [];
    const tipoRaiz = new Map(raices.map((r) => [r.id, r.tipo]));
    const vivos = impactos.filter((i) => i.origen_tipo !== 'EVENTO_FINANCIERO' || !eventoPorId.get(i.origen_id)?.anulado);

    // El otro lado de cada movimiento entre cuentas: las que no están en el grupo.
    const otrosLados = eventoIds.length
      ? await this.prisma.impacto_patrimonial.findMany({
          where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: { in: eventoIds }, elemento_id: { notIn: ids } },
          select: { origen_id: true, elemento_id: true },
        })
      : [];
    const otroLadoIds = [...new Set(otrosLados.map((o) => o.elemento_id))];
    const otrosEls = otroLadoIds.length
      ? await this.prisma.elemento_patrimonial.findMany({
          where: { id: { in: otroLadoIds } },
          select: { id: true, categoria_funcional: true, naturaleza: true, elemento_propietario: { select: { usuario: { select: { id: true, nombre: true } } } } },
        })
      : [];
    const otroPorId = new Map(otrosEls.map((e) => [e.id, e]));
    const otroLadoDe = new Map<string, string>();
    for (const o of otrosLados) if (!otroLadoDe.has(o.origen_id)) otroLadoDe.set(o.origen_id, o.elemento_id);

    const clasificar = (i: (typeof vivos)[number]): { clase: string; persona: LineaFotoMesDTO['persona'] } => {
      if (i.origen_tipo !== 'EVENTO_FINANCIERO') return { clase: 'AJUSTE', persona: null };
      const ev = eventoPorId.get(i.origen_id);
      const tipo = (ev?.correccion_de_id ? tipoRaiz.get(ev.correccion_de_id) : ev?.tipo) ?? 'OTRAS';
      if (tipo === 'INGRESO' || tipo === 'GASTO' || tipo === 'SALDO_INICIAL') return { clase: tipo, persona: null };
      const otroId = otroLadoDe.get(i.origen_id);
      if (!otroId) return { clase: 'CAMBIO_MONEDA', persona: null };
      const otro = otroPorId.get(otroId);
      const duenos = otro?.elemento_propietario.map((p) => p.usuario) ?? [];
      if (duenos.length && !duenos.some((d) => d.id === actorId)) {
        return { clase: 'PERSONA', persona: { usuarioId: duenos[0].id, nombre: duenos[0].nombre } };
      }
      const cat = otro?.categoria_funcional;
      if (cat === 'DEUDA' && otro?.naturaleza === 'CUSTODIA_INFORMAL') return { clase: 'CUSTODIA', persona: null };
      return { clase: cat === 'RESERVA' ? 'AHORRO' : cat === 'INVERSION' ? 'INVERSION' : cat === 'DEUDA' ? 'DEUDA' : 'OTRAS', persona: null };
    };

    const porMoneda = new Map<string, FotoMesPorMonedaDTO>();
    const deMoneda = (m: string) => {
      const x = porMoneda.get(m) ?? { moneda: m, tenias: 0, tienes: 0, lineas: [], apartadoMetas: 0 };
      porMoneda.set(m, x);
      return x;
    };
    for (const e of els) {
      const despuesDe = (d: Date) =>
        vivos.filter((i) => i.elemento_id === e.id && i.fecha > d).reduce((s, i) => s + Number(i.monto), 0);
      const vigente = Number(e.valor_vigente);
      const x = deMoneda(e.moneda);
      x.tenias += vigente - despuesDe(new Date(desde.getTime() - 86_400_000));
      x.tienes += vigente - despuesDe(hasta);
    }

    // Neto por movimiento y moneda: un movimiento entre dos cuentas del grupo da 0 y no aparece.
    const netos = new Map<string, { moneda: string; monto: number; i: (typeof vivos)[number] }>();
    for (const i of vivos) {
      if (i.fecha < desde || i.fecha > hasta) continue;
      const moneda = enGrupo.get(i.elemento_id)!.moneda;
      const k = `${i.origen_tipo}|${i.origen_id}|${moneda}`;
      const n = netos.get(k) ?? { moneda, monto: 0, i };
      n.monto += Number(i.monto);
      netos.set(k, n);
    }
    const lineas = new Map<string, LineaFotoMesDTO & { moneda: string }>();
    for (const n of netos.values()) {
      if (Math.abs(n.monto) < 0.005) continue;
      const { clase, persona } = clasificar(n.i);
      const k = `${n.moneda}|${clase}|${n.monto < 0 ? '-' : '+'}|${persona?.usuarioId ?? ''}`;
      const l = lineas.get(k) ?? { moneda: n.moneda, clase, monto: 0, persona };
      l.monto += n.monto;
      lineas.set(k, l);
    }
    for (const { moneda, ...l } of lineas.values()) deMoneda(moneda).lineas.push(l);

    const reservas = ids.length
      ? await this.prisma.reserva.findMany({ where: { elemento_origen_id: { in: ids }, estado: 'ACTIVA' } })
      : [];
    for (const r of reservas) deMoneda(enGrupo.get(r.elemento_origen_id)!.moneda).apartadoMetas += Number(r.monto);

    const redondear = (v: number) => Math.round(v * 100) / 100;
    return {
      periodo: { desde: desdeISO.slice(0, 10), hasta: hastaISO.slice(0, 10) },
      cuentas: ids,
      porMoneda: [...porMoneda.values()]
        .map((x) => ({
          ...x,
          tenias: redondear(x.tenias),
          tienes: redondear(x.tienes),
          apartadoMetas: redondear(x.apartadoMetas),
          lineas: x.lineas.map((l) => ({ ...l, monto: redondear(l.monto) })).sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto)),
        }))
        .sort((a, b) => a.moneda.localeCompare(b.moneda)),
    };
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
    actorId: string,
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
    // G42: con las cuentas del día a día, la cuenta del otro lado puede ser tuya
    // (o compartida contigo): eso no es pasarle plata a alguien.
    const tuyas = new Set(duenos.filter((d) => d.usuario.id === actorId).map((d) => d.elemento_id));
    const duenoDe = new Map<string, { usuarioId: string; nombre: string }>();
    for (const d of duenos) {
      if (tuyas.has(d.elemento_id)) continue;
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
