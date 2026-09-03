import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ConversionService } from './conversion.service.js';

/** PrismaService falso: `tipo_cambio.findFirst` devuelve lo que se le programe. */
function fakePrisma(filas: {
  moneda_origen: string;
  moneda_destino: string;
  tasa: number;
  fecha_vigencia: string;
}[]) {
  return {
    tipo_cambio: {
      findFirst: vi.fn(async ({ where, orderBy: _o }: { where: Record<string, unknown> }) => {
        const o = where.moneda_origen as string;
        const d = where.moneda_destino as string;
        const lte = (where.fecha_vigencia as { lte: Date }).lte;
        const match = filas
          .filter(
            (f) =>
              f.moneda_origen === o &&
              f.moneda_destino === d &&
              new Date(f.fecha_vigencia) <= lte,
          )
          .sort((a, b) => (a.fecha_vigencia < b.fecha_vigencia ? 1 : -1))[0];
        return match ? { ...match, tasa: new Prisma.Decimal(match.tasa) } : null;
      }),
    },
  };
}

describe('ConversionService', () => {
  let svc: ConversionService;

  const setup = (filas: Parameters<typeof fakePrisma>[0]) => {
    svc = new ConversionService(fakePrisma(filas) as never);
  };

  beforeEach(() => setup([]));

  it('misma moneda: devuelve el monto sin tocar la DB', async () => {
    const r = await svc.convertir(new Prisma.Decimal(100), 'CLP', 'CLP', new Date('2026-06-01'));
    expect(r.toNumber()).toBe(100);
  });

  it('usa la tasa directa más reciente vigente a la fecha', async () => {
    setup([
      { moneda_origen: 'USD', moneda_destino: 'CLP', tasa: 900, fecha_vigencia: '2026-01-01' },
      { moneda_origen: 'USD', moneda_destino: 'CLP', tasa: 1000, fecha_vigencia: '2026-06-01' },
    ]);
    expect(
      (await svc.convertir(new Prisma.Decimal(2), 'USD', 'CLP', new Date('2026-03-01'))).toNumber(),
    ).toBe(1800);
    expect(
      (await svc.convertir(new Prisma.Decimal(2), 'USD', 'CLP', new Date('2026-07-01'))).toNumber(),
    ).toBe(2000);
  });

  it('cae al inverso (1/tasa) cuando no hay par directo', async () => {
    setup([
      { moneda_origen: 'USD', moneda_destino: 'CLP', tasa: 1000, fecha_vigencia: '2026-01-01' },
    ]);
    const r = await svc.convertir(new Prisma.Decimal(5000), 'CLP', 'USD', new Date('2026-06-01'));
    expect(r.toNumber()).toBe(5);
  });

  it('lanza si no hay tasa en ningún sentido', async () => {
    await expect(
      svc.convertir(new Prisma.Decimal(1), 'USD', 'EUR', new Date('2026-06-01')),
    ).rejects.toThrow(/tipo de cambio USD→EUR/);
    expect(await svc.disponible('USD', 'EUR', new Date('2026-06-01'))).toBe(false);
  });
});
