import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ValorHistoricoElementoDTO {
  elementoId: string;
  fecha: string;
  moneda: string;
  /** Valor vigente reconstruido a esa fecha (valor_vigente − impactos posteriores). */
  valor: number;
  /** P10: false si a esa fecha el elemento aún no existía (fecha < fecha_alta) o
   *  ya había salido del patrimonio (fecha_baja && fecha >= fecha_baja). */
  existia: boolean;
}

export interface PatrimonioHistoricoPorMoneda {
  moneda: string;
  patrimonio: number;
}

export interface PatrimonioHistoricoDTO {
  usuarioId: string;
  fecha: string;
  porMoneda: PatrimonioHistoricoPorMoneda[];
  elementos: number;
}

export interface VariacionPatrimonialDTO {
  usuarioId: string;
  desde: string;
  hasta: string;
  porMoneda: {
    moneda: string;
    patrimonioDesde: number;
    patrimonioHasta: number;
    variacion: number;
    variacionPorcentaje: number | null;
  }[];
}

export interface SeriePatrimonialDTO {
  usuarioId: string;
  desde: string;
  hasta: string;
  /** Un punto por fecha muestreada, en orden cronológico. */
  puntos: { fecha: string; porMoneda: PatrimonioHistoricoPorMoneda[] }[];
}

/**
 * Reconstrucción histórica de estado (DDD Sección V): responde "¿cuál era el
 * valor de esta entidad en un momento pasado?" aplicando en orden los hechos
 * económicos con fecha <= X. Se calcula retrocediendo desde `valor_vigente`
 * (que ya refleja el estado actual) y restando los impactos posteriores a X.
 *
 * La auditoría NO participa (Sección V).
 *
 * P10 (migración 020): el elemento lleva `fecha_alta` / `fecha_baja`. La
 * reconstrucción los usa como ventana de existencia — a una fecha fuera de
 * `[fecha_alta, fecha_baja)` el elemento no cuenta en el patrimonio (y
 * `valorHistoricoElemento` devuelve `existia: false`). Ya NO se usa el estado
 * ACTIVO/INACTIVO actual.
 *
 * GAPS.md G38 — anotar no es ganar ni perder: en la variación y en la serie
 * (lo que muestra "cuánto cambió"), una cuenta o bien activo cuenta ANTES de su
 * `fecha_alta` con el valor con que se anotó. Así cargar una deuda de 2024 hoy
 * no aparece como una caída de hoy; el gráfico solo se mueve con los hechos
 * (movimientos, valorizaciones, ajustes). Los dados de baja siguen la ventana
 * `[fecha_alta, fecha_baja)`, para que el último punto sea el total de hoy. El
 * patrimonio a una fecha (`patrimonioIndividualHistorico`) no cambia: dice lo
 * que de verdad había anotado a esa fecha.
 *
 * Simplificación que queda (GAPS.md G18): un impacto de un evento hoy anulado se
 * considera inexistente en toda la línea de tiempo (la anulación no tiene fecha
 * de hecho económico).
 */
@Injectable()
export class ReconstruccionService {
  constructor(private readonly prisma: PrismaService) {}

  async valorHistoricoElemento(
    elementoId: string,
    actorId: string,
    fechaISO: string,
  ): Promise<ValorHistoricoElementoDTO> {
    const el = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!el) throw new NotFoundException('Elemento no encontrado');
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario de ese elemento');

    const fecha = this.#soloFecha(fechaISO);
    const existia = this.#existiaA(el, fecha);
    return {
      elementoId,
      fecha,
      moneda: el.moneda,
      valor: existia ? (await this.#valorElementoA(el, fecha)).toNumber() : 0,
      existia,
    };
  }

  async patrimonioIndividualHistorico(
    usuarioId: string,
    fechaISO: string,
  ): Promise<PatrimonioHistoricoDTO> {
    return this.#patrimonioA(usuarioId, fechaISO, false);
  }

  /**
   * Patrimonio individual a `fecha`. Con `comparable` (G38), un elemento activo
   * anotado después de `fecha` cuenta con su valor al anotarse.
   */
  async #patrimonioA(
    usuarioId: string,
    fechaISO: string,
    comparable: boolean,
  ): Promise<PatrimonioHistoricoDTO> {
    const fecha = this.#soloFecha(fechaISO);
    const filas = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: usuarioId },
      include: { elemento_patrimonial: true },
    });
    const vigentesEnLaFecha = filas.filter(
      (f) =>
        this.#existiaA(f.elemento_patrimonial, fecha) ||
        (comparable && this.#cargadoDespues(f.elemento_patrimonial, fecha)),
    );

    const acc = new Map<string, Prisma.Decimal>();
    for (const f of vigentesEnLaFecha) {
      const el = f.elemento_patrimonial;
      const valorA = await this.#valorElementoA(
        el,
        this.#cargadoDespues(el, fecha) ? el.fecha_alta!.toISOString().slice(0, 10) : fecha,
      );
      const parte = valorA.times(f.porcentaje).dividedBy(100);
      acc.set(
        f.elemento_patrimonial.moneda,
        (acc.get(f.elemento_patrimonial.moneda) ?? new Prisma.Decimal(0)).plus(parte),
      );
    }

    return {
      usuarioId,
      fecha,
      elementos: vigentesEnLaFecha.length,
      porMoneda: [...acc.entries()]
        .map(([moneda, v]) => ({ moneda, patrimonio: v.toNumber() }))
        .sort((a, b) => a.moneda.localeCompare(b.moneda)),
    };
  }

  async variacionPatrimonial(
    usuarioId: string,
    desdeISO: string,
    hastaISO?: string,
  ): Promise<VariacionPatrimonialDTO> {
    const hasta = hastaISO ? this.#soloFecha(hastaISO) : this.#soloFecha(new Date().toISOString());
    const [a, b] = await Promise.all([
      this.#patrimonioA(usuarioId, desdeISO, true),
      this.#patrimonioA(usuarioId, hasta, true),
    ]);
    const monedas = [...new Set([...a.porMoneda, ...b.porMoneda].map((x) => x.moneda))].sort();
    return {
      usuarioId,
      desde: a.fecha,
      hasta: b.fecha,
      porMoneda: monedas.map((moneda) => {
        const pd = a.porMoneda.find((x) => x.moneda === moneda)?.patrimonio ?? 0;
        const ph = b.porMoneda.find((x) => x.moneda === moneda)?.patrimonio ?? 0;
        return {
          moneda,
          patrimonioDesde: pd,
          patrimonioHasta: ph,
          variacion: Math.round((ph - pd) * 100) / 100,
          variacionPorcentaje:
            pd === 0 ? null : Math.round(((ph - pd) / Math.abs(pd)) * 1000) / 10,
        };
      }),
    };
  }

  /**
   * Serie temporal del patrimonio individual: `pasos` fechas equiespaciadas
   * entre `desde` y `hasta` (ambas incluidas), cada una reconstruida como la
   * `patrimonioIndividualHistorico`. Para el gráfico de evolución.
   */
  async seriePatrimonial(
    usuarioId: string,
    desdeISO: string,
    hastaISO: string | undefined,
    pasos: number,
  ): Promise<SeriePatrimonialDTO> {
    const desde = new Date(`${this.#soloFecha(desdeISO)}T00:00:00.000Z`);
    const hasta = new Date(
      `${hastaISO ? this.#soloFecha(hastaISO) : this.#soloFecha(new Date().toISOString())}T00:00:00.000Z`,
    );
    const n = Math.max(2, Math.min(24, Math.floor(pasos) || 12));
    const span = hasta.getTime() - desde.getTime();

    const fechas: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = span <= 0 ? hasta.getTime() : desde.getTime() + Math.round((span * i) / (n - 1));
      fechas.push(new Date(t).toISOString().slice(0, 10));
    }
    const unicas = [...new Set(fechas)];

    const puntos = await Promise.all(
      unicas.map(async (fecha) => {
        const p = await this.#patrimonioA(usuarioId, fecha, true);
        return { fecha, porMoneda: p.porMoneda };
      }),
    );

    return {
      usuarioId,
      desde: unicas[0],
      hasta: unicas[unicas.length - 1],
      puntos,
    };
  }

  // ── Núcleo ────────────────────────────────────────────────────────────────

  /** P10 — ¿el elemento existía en el patrimonio a `fecha` (YYYY-MM-DD)? */
  #existiaA(el: ElementoRow, fecha: string): boolean {
    const alta = el.fecha_alta ? el.fecha_alta.toISOString().slice(0, 10) : null;
    const baja = el.fecha_baja ? el.fecha_baja.toISOString().slice(0, 10) : null;
    if (alta && fecha < alta) return false;
    if (baja && fecha >= baja) return false;
    return true;
  }

  /** G38 — activo hoy (sin baja) y anotado después de `fecha`. */
  #cargadoDespues(el: ElementoRow, fecha: string): boolean {
    if (el.fecha_baja || !el.fecha_alta) return false;
    return fecha < el.fecha_alta.toISOString().slice(0, 10);
  }

  /** valor_vigente actual − Σ impactos vivos con fecha posterior a `fecha`. */
  async #valorElementoA(el: ElementoRow, fecha: string): Promise<Prisma.Decimal> {
    const posteriores = await this.prisma.impacto_patrimonial.findMany({
      where: { elemento_id: el.id, fecha: { gt: new Date(`${fecha}T00:00:00.000Z`) } },
    });
    const eventoIds = posteriores
      .filter((i) => i.origen_tipo === 'EVENTO_FINANCIERO')
      .map((i) => i.origen_id);
    const anulados = new Set(
      (
        await this.prisma.evento_financiero.findMany({
          where: { id: { in: eventoIds }, anulado: true },
          select: { id: true },
        })
      ).map((e) => e.id),
    );
    let valor = new Prisma.Decimal(el.valor_vigente);
    for (const i of posteriores) {
      if (i.origen_tipo === 'EVENTO_FINANCIERO' && anulados.has(i.origen_id)) continue;
      valor = valor.minus(i.monto);
    }
    return valor;
  }

  #soloFecha(iso: string): string {
    return iso.slice(0, 10);
  }
}
