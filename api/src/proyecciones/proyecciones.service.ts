import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PatrimonioPorMoneda {
  moneda: string;
  patrimonio: number;
  valorLiquido: number;
  /** Σ reservas ACTIVAS sobre elementos del usuario en esta moneda (REQUISITES §H). */
  valorReservado: number;
  /**
   * La parte de valorReservado que está en elementos líquidos: es la única que
   * se resta de la liquidez (la plata de una meta en una cuenta de ahorro o una
   * inversión no estaba en valorLiquido).
   */
  reservadoEnLiquidez: number;
  /**
   * HZ-18 — Σ lo que debes en encargos o custodias (DEUDA CUSTODIA_INFORMAL,
   * D-3): plata de otras personas que está en tus cuentas.
   */
  plataAjena: number;
  /**
   * valorLiquido − reservadoEnLiquidez − plataAjena = "lo que puedo usar sin
   * tocar una meta ni la plata de otra persona" (Libre para gastar).
   */
  valorLibre: number;
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

    const acc = new Map<
      string,
      {
        patrimonio: Prisma.Decimal;
        liquido: Prisma.Decimal;
        reservado: Prisma.Decimal;
        reservadoLiquido: Prisma.Decimal;
        ajena: Prisma.Decimal;
      }
    >();
    const nueva = () => ({
      patrimonio: new Prisma.Decimal(0),
      liquido: new Prisma.Decimal(0),
      reservado: new Prisma.Decimal(0),
      reservadoLiquido: new Prisma.Decimal(0),
      ajena: new Prisma.Decimal(0),
    });
    for (const f of activos) {
      const el = f.elemento_patrimonial;
      const parte = new Prisma.Decimal(el.valor_vigente)
        .times(f.porcentaje)
        .dividedBy(100);
      const cur = acc.get(el.moneda) ?? nueva();
      cur.patrimonio = cur.patrimonio.plus(parte);
      if (el.participa_valor_liquido) cur.liquido = cur.liquido.plus(parte);
      if (el.categoria_funcional === 'DEUDA' && el.naturaleza === 'CUSTODIA_INFORMAL') {
        cur.ajena = cur.ajena.plus(parte.abs());
      }
      acc.set(el.moneda, cur);
    }

    // Valor reservado por moneda: reservas ACTIVAS sobre los elementos del
    // usuario (el monto de la reserva no se pondera por % de copropiedad — la
    // validación de disponibilidad tampoco lo hace; ver GAPS.md G6).
    const monedaPorElemento = new Map(activos.map((f) => [f.elemento_id, f.elemento_patrimonial.moneda]));
    const liquidos = new Set(
      activos.filter((f) => f.elemento_patrimonial.participa_valor_liquido).map((f) => f.elemento_id),
    );
    const reservas = await this.prisma.reserva.findMany({
      where: { elemento_origen_id: { in: [...monedaPorElemento.keys()] }, estado: 'ACTIVA' },
      select: { monto: true, elemento_origen_id: true },
    });
    for (const r of reservas) {
      const moneda = monedaPorElemento.get(r.elemento_origen_id);
      if (!moneda) continue;
      const cur = acc.get(moneda) ?? nueva();
      cur.reservado = cur.reservado.plus(r.monto);
      if (liquidos.has(r.elemento_origen_id)) cur.reservadoLiquido = cur.reservadoLiquido.plus(r.monto);
      acc.set(moneda, cur);
    }

    return {
      usuarioId,
      elementos: activos.length,
      porMoneda: [...acc.entries()]
        .map(([moneda, v]) => ({
          moneda,
          patrimonio: v.patrimonio.toNumber(),
          valorLiquido: v.liquido.toNumber(),
          valorReservado: v.reservado.toNumber(),
          reservadoEnLiquidez: v.reservadoLiquido.toNumber(),
          plataAjena: v.ajena.toNumber(),
          valorLibre: v.liquido.minus(v.reservadoLiquido).minus(v.ajena).toNumber(),
        }))
        .sort((a, b) => a.moneda.localeCompare(b.moneda)),
    };
  }
}
