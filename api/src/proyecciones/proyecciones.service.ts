import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PatrimonioPorMoneda {
  moneda: string;
  patrimonio: number;
  valorLiquido: number;
}

export interface PatrimonioIndividualDTO {
  usuarioId: string;
  porMoneda: PatrimonioPorMoneda[];
  elementos: number;
  /**
   * Sin total consolidado: requiere tipos de cambio (Sección S REQUISITES,
   * pendiente). Ver GAPS.md G7.
   */
}

/**
 * Proyección de lectura patrimonio_individual (DATABASE_DESIGN §12).
 * Se calcula EN VIVO desde la información primaria (Principio 1) — la decisión
 * vista-en-vivo vs. tabla materializada queda pendiente (performance, GAPS.md G7).
 */
@Injectable()
export class ProyeccionesService {
  constructor(private readonly prisma: PrismaService) {}

  async patrimonioIndividual(usuarioId: string): Promise<PatrimonioIndividualDTO> {
    const filas = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: usuarioId },
      include: { elemento_patrimonial: true },
    });
    const activos = filas.filter((f) => f.elemento_patrimonial.estado === 'ACTIVO');

    const acc = new Map<string, { patrimonio: Prisma.Decimal; liquido: Prisma.Decimal }>();
    for (const f of activos) {
      const el = f.elemento_patrimonial;
      const parte = new Prisma.Decimal(el.valor_vigente)
        .times(f.porcentaje)
        .dividedBy(100);
      const cur = acc.get(el.moneda) ?? {
        patrimonio: new Prisma.Decimal(0),
        liquido: new Prisma.Decimal(0),
      };
      cur.patrimonio = cur.patrimonio.plus(parte);
      if (el.participa_valor_liquido) cur.liquido = cur.liquido.plus(parte);
      acc.set(el.moneda, cur);
    }

    return {
      usuarioId,
      elementos: activos.length,
      porMoneda: [...acc.entries()]
        .map(([moneda, v]) => ({
          moneda,
          patrimonio: v.patrimonio.toNumber(),
          valorLiquido: v.liquido.toNumber(),
        }))
        .sort((a, b) => a.moneda.localeCompare(b.moneda)),
    };
  }
}
