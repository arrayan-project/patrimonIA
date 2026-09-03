import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { derivarValorPendiente, tienePendiente } from './deuda.js';

describe('tienePendiente', () => {
  it('solo DEUDA y CREDITO llevan valor_pendiente', () => {
    expect(tienePendiente('DEUDA')).toBe(true);
    expect(tienePendiente('CREDITO')).toBe(true);
    expect(tienePendiente('LIQUIDEZ')).toBe(false);
    expect(tienePendiente('ACTIVO')).toBe(false);
  });
});

describe('derivarValorPendiente', () => {
  const tx = (elemento: Record<string, unknown>) => {
    const update = vi.fn().mockResolvedValue(undefined);
    return {
      client: {
        elemento_patrimonial: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(elemento),
          update,
        },
      },
      update,
    };
  };

  it('no toca elementos que no son DEUDA/CREDITO', async () => {
    const { client, update } = tx({
      id: 'e1',
      categoria_funcional: 'LIQUIDEZ',
      valor_vigente: new Prisma.Decimal(-500),
      valor_pendiente: null,
    });
    await derivarValorPendiente(client as never, 'e1');
    expect(update).not.toHaveBeenCalled();
  });

  it('fija valor_pendiente = |valor_vigente| en una DEUDA', async () => {
    const { client, update } = tx({
      id: 'e1',
      categoria_funcional: 'DEUDA',
      valor_vigente: new Prisma.Decimal(-500),
      valor_pendiente: new Prisma.Decimal(800),
    });
    await derivarValorPendiente(client as never, 'e1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { valor_pendiente: expect.any(Prisma.Decimal) },
    });
    expect(update.mock.calls[0][0].data.valor_pendiente.toNumber()).toBe(500);
  });

  it('no escribe si ya está en el valor correcto (idempotente)', async () => {
    const { client, update } = tx({
      id: 'e1',
      categoria_funcional: 'CREDITO',
      valor_vigente: new Prisma.Decimal(300),
      valor_pendiente: new Prisma.Decimal(300),
    });
    await derivarValorPendiente(client as never, 'e1');
    expect(update).not.toHaveBeenCalled();
  });
});
