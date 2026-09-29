import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/** Indicador de mindicador.cl → moneda ISO (todas cotizadas en CLP). UF = CLF. */
const INDICADORES: Record<string, string> = { dolar: 'USD', euro: 'EUR', uf: 'CLF' };

export const FUENTE_MINDICADOR = 'mindicador.cl';

interface Indicador {
  fecha: string;
  valor: number;
}

/** Fecha calendario en Chile (mindicador publica a las 00:00 hora de Santiago). */
function fechaChile(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

/**
 * G21 — importación automática de tipos de cambio desde mindicador.cl (gratis,
 * sin API key). Solo corre si `TIPOS_CAMBIO_IMPORTACION=true`.
 *
 * Render free duerme el servicio, así que no se confía en una hora fija: se
 * importa al arrancar y cada hora mientras esté despierto. Es idempotente por
 * la UNIQUE (origen, destino, fecha_vigencia): una tasa ya cargada (a mano o por
 * una corrida anterior) no se pisa. Sin auditoría: no hay usuario actor y la
 * fila queda trazada por `fuente = 'mindicador.cl'`.
 */
@Injectable()
export class ImportacionTasasService implements OnApplicationBootstrap {
  private readonly logger = new Logger('ImportacionTasas');

  constructor(private readonly prisma: PrismaService) {}

  get habilitada(): boolean {
    return process.env.TIPOS_CAMBIO_IMPORTACION === 'true';
  }

  onApplicationBootstrap(): void {
    if (this.habilitada) void this.importar();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async programada(): Promise<void> {
    if (this.habilitada) await this.importar();
  }

  /** Devuelve cuántas tasas nuevas se insertaron. Best-effort: nunca lanza. */
  async importar(): Promise<number> {
    try {
      const res = await fetch('https://mindicador.cl/api', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      const body = (await res.json()) as Record<string, Indicador | undefined>;

      const filas = Object.entries(INDICADORES).flatMap(([codigo, moneda]) => {
        const ind = body[codigo];
        if (!ind || !(ind.valor > 0) || !ind.fecha) return [];
        return [
          {
            moneda_origen: moneda,
            moneda_destino: 'CLP',
            tasa: new Prisma.Decimal(ind.valor),
            fecha_vigencia: new Date(`${fechaChile(ind.fecha)}T00:00:00.000Z`),
            fuente: FUENTE_MINDICADOR,
          },
        ];
      });
      if (filas.length === 0) throw new Error('respuesta sin indicadores');

      const { count } = await this.prisma.tipo_cambio.createMany({
        data: filas,
        skipDuplicates: true,
      });
      if (count > 0) this.logger.log(`Importadas ${count} tasas desde ${FUENTE_MINDICADOR}`);
      return count;
    } catch (e) {
      this.logger.warn(`No se pudieron importar tasas: ${(e as Error).message}`);
      return 0;
    }
  }
}
