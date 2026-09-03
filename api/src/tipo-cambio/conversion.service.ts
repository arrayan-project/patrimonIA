import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export class TipoCambioNoDisponibleError extends BadRequestException {
  constructor(origen: string, destino: string, fecha: string) {
    super(`No hay tipo de cambio ${origen}→${destino} vigente al ${fecha}`);
  }
}

/**
 * Conversión monetaria (REQUISITES §524–532). Usa la tasa más reciente con
 * `fecha_vigencia <= fecha`. Si no hay par directo, usa el inverso (1/tasa).
 * Sin triangulación por una moneda pivote (GAPS.md G21).
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
    const directo = await this.prisma.tipo_cambio.findFirst({
      where: { moneda_origen: origen, moneda_destino: destino, fecha_vigencia: { lte: fecha } },
      orderBy: { fecha_vigencia: 'desc' },
    });
    if (directo) return new Prisma.Decimal(directo.tasa);

    const inverso = await this.prisma.tipo_cambio.findFirst({
      where: { moneda_origen: destino, moneda_destino: origen, fecha_vigencia: { lte: fecha } },
      orderBy: { fecha_vigencia: 'desc' },
    });
    if (inverso) return new Prisma.Decimal(1).dividedBy(inverso.tasa);

    throw new TipoCambioNoDisponibleError(origen, destino, fecha.toISOString().slice(0, 10));
  }
}
