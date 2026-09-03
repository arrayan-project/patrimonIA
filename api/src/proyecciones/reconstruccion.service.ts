import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ValorHistoricoElementoDTO {
  elementoId: string;
  fecha: string;
  moneda: string;
  /** Valor vigente reconstruido a esa fecha (valor_vigente − impactos posteriores). */
  valor: number;
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

/**
 * Reconstrucción histórica de estado (DDD Sección V): responde "¿cuál era el
 * valor de esta entidad en un momento pasado?" aplicando en orden los hechos
 * económicos con fecha <= X. Se calcula retrocediendo desde `valor_vigente`
 * (que ya refleja el estado actual) y restando los impactos posteriores a X.
 *
 * La auditoría NO participa (Sección V). Simplificaciones (GAPS.md G18):
 * - no hay "fecha de alta" del elemento: para fechas anteriores a toda actividad
 *   la reconstrucción devuelve su valor inicial (no distingue "no existía");
 * - se usa el `estado` ACTIVO/INACTIVO actual del elemento (desactivar/reactivar
 *   son config sin fecha de hecho económico);
 * - un impacto de un evento hoy anulado se considera inexistente en toda la
 *   línea de tiempo (la anulación tampoco tiene fecha de hecho económico).
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
    return {
      elementoId,
      fecha,
      moneda: el.moneda,
      valor: (await this.#valorElementoA(el, fecha)).toNumber(),
    };
  }

  async patrimonioIndividualHistorico(
    usuarioId: string,
    fechaISO: string,
  ): Promise<PatrimonioHistoricoDTO> {
    const fecha = this.#soloFecha(fechaISO);
    const filas = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: usuarioId },
      include: { elemento_patrimonial: true },
    });
    const vigentesEnLaFecha = filas.filter((f) => f.elemento_patrimonial.estado === 'ACTIVO');

    const acc = new Map<string, Prisma.Decimal>();
    for (const f of vigentesEnLaFecha) {
      const valorA = await this.#valorElementoA(f.elemento_patrimonial, fecha);
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
      this.patrimonioIndividualHistorico(usuarioId, desdeISO),
      this.patrimonioIndividualHistorico(usuarioId, hasta),
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

  // ── Núcleo ────────────────────────────────────────────────────────────────

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
