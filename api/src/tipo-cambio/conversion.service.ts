import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export class TipoCambioNoDisponibleError extends BadRequestException {
  constructor(origen: string, destino: string, fecha: string) {
    super(`No hay tipo de cambio ${origen}→${destino} vigente al ${fecha}`);
  }
}

/**
 * Conversión monetaria (REQUISITES §524–532). Para A→B a una fecha:
 *   1. tasa directa A→B más reciente con `fecha_vigencia <= fecha`;
 *   2. si no hay, el inverso B→A (1/tasa);
 *   3. si no hay, **triangulación por una moneda pivote** C tal que existan
 *      A↔C y C↔B (máx. 2 saltos). Si hay varias pivotes, se elige la primera
 *      por orden alfabético — determinista (GAPS.md G21).
 */
@Injectable()
export class ConversionService {
  constructor(private readonly prisma: PrismaService) {}

  async convertir(
    monto: Prisma.Decimal,
    origen: string,
    destino: string,
    fecha: Date,
  ): Promise<Prisma.Decimal> {
    if (origen === destino) return monto;
    const tasa = await this.tasa(origen, destino, fecha);
    return monto.times(tasa);
  }

  /** ¿Se puede convertir origen→destino a esa fecha? */
  async disponible(origen: string, destino: string, fecha: Date): Promise<boolean> {
    if (origen === destino) return true;
    try {
      await this.tasa(origen, destino, fecha);
      return true;
    } catch {
      return false;
    }
  }

  async tasa(origen: string, destino: string, fecha: Date): Promise<Prisma.Decimal> {
    const directa = await this.#tasaPar(origen, destino, fecha);
    if (directa) return directa;

    const pivote = await this.#tasaTriangulada(origen, destino, fecha);
    if (pivote) return pivote;

    throw new TipoCambioNoDisponibleError(origen, destino, fecha.toISOString().slice(0, 10));
  }

  /** Tasa A→B directa o por el inverso B→A. null si ninguna existe a la fecha. */
  async #tasaPar(a: string, b: string, fecha: Date): Promise<Prisma.Decimal | null> {
    const directo = await this.prisma.tipo_cambio.findFirst({
      where: { moneda_origen: a, moneda_destino: b, fecha_vigencia: { lte: fecha } },
      orderBy: { fecha_vigencia: 'desc' },
    });
    if (directo) return new Prisma.Decimal(directo.tasa);

    const inverso = await this.prisma.tipo_cambio.findFirst({
      where: { moneda_origen: b, moneda_destino: a, fecha_vigencia: { lte: fecha } },
      orderBy: { fecha_vigencia: 'desc' },
    });
    if (inverso) return new Prisma.Decimal(1).dividedBy(inverso.tasa);

    return null;
  }

  async #tasaTriangulada(
    origen: string,
    destino: string,
    fecha: Date,
  ): Promise<Prisma.Decimal | null> {
    const filas = await this.prisma.tipo_cambio.findMany({
      where: { fecha_vigencia: { lte: fecha } },
      select: { moneda_origen: true, moneda_destino: true },
    });
    const monedas = new Set<string>();
    for (const f of filas) {
      monedas.add(f.moneda_origen);
      monedas.add(f.moneda_destino);
    }
    monedas.delete(origen);
    monedas.delete(destino);

    for (const pivote of [...monedas].sort()) {
      const aPivote = await this.#tasaPar(origen, pivote, fecha);
      if (!aPivote) continue;
      const pivoteADestino = await this.#tasaPar(pivote, destino, fecha);
      if (!pivoteADestino) continue;
      return aPivote.times(pivoteADestino);
    }
    return null;
  }
}
