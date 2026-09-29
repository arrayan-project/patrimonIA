import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportacionTasasService } from './importacion-tasas.service.js';

function fakePrisma(count = 3) {
  return { tipo_cambio: { createMany: vi.fn(async () => ({ count })) } };
}

function mockFetch(res: { ok: boolean; status?: number; body?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: res.ok, status: res.status ?? 200, json: async () => res.body })),
  );
}

const RESPUESTA = {
  uf: { fecha: '2026-09-29T03:00:00.000Z', valor: 41049.01 },
  dolar: { fecha: '2026-09-29T03:00:00.000Z', valor: 969.7 },
  euro: { fecha: '2026-09-29T03:00:00.000Z', valor: 1050.5 },
  utm: { fecha: '2026-09-01T04:00:00.000Z', valor: 70000 },
};

describe('ImportacionTasasService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TIPOS_CAMBIO_IMPORTACION;
  });

  it('inserta USD, EUR y CLF contra CLP con la fecha de Chile, sin pisar existentes', async () => {
    mockFetch({ ok: true, body: RESPUESTA });
    const prisma = fakePrisma();
    const n = await new ImportacionTasasService(prisma as never).importar();

    expect(n).toBe(3);
    const { data, skipDuplicates } = prisma.tipo_cambio.createMany.mock.calls[0][0] as {
      data: { moneda_origen: string; moneda_destino: string; tasa: unknown; fecha_vigencia: Date }[];
      skipDuplicates: boolean;
    };
    expect(skipDuplicates).toBe(true);
    expect(data.map((f) => f.moneda_origen).sort()).toEqual(['CLF', 'EUR', 'USD']);
    expect(data.every((f) => f.moneda_destino === 'CLP')).toBe(true);
    expect(data.every((f) => f.fecha_vigencia.toISOString() === '2026-09-29T00:00:00.000Z')).toBe(
      true,
    );
    expect(Number(data.find((f) => f.moneda_origen === 'USD')!.tasa)).toBe(969.7);
  });

  it('ante un error HTTP no lanza y no inserta nada', async () => {
    mockFetch({ ok: false, status: 503 });
    const prisma = fakePrisma();
    expect(await new ImportacionTasasService(prisma as never).importar()).toBe(0);
    expect(prisma.tipo_cambio.createMany).not.toHaveBeenCalled();
  });

  it('ignora indicadores ausentes o con valor inválido', async () => {
    mockFetch({ ok: true, body: { dolar: RESPUESTA.dolar, euro: { fecha: 'x', valor: 0 } } });
    const prisma = fakePrisma(1);
    await new ImportacionTasasService(prisma as never).importar();
    const { data } = prisma.tipo_cambio.createMany.mock.calls[0][0] as {
      data: { moneda_origen: string }[];
    };
    expect(data.map((f) => f.moneda_origen)).toEqual(['USD']);
  });

  it('el cron no hace nada si TIPOS_CAMBIO_IMPORTACION no es true', async () => {
    mockFetch({ ok: true, body: RESPUESTA });
    const prisma = fakePrisma();
    await new ImportacionTasasService(prisma as never).programada();
    expect(fetch).not.toHaveBeenCalled();
  });
});
