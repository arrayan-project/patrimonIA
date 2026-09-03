import { describe, expect, it } from 'vitest';
import { Prisma, type presupuesto as PresupuestoRow } from '@prisma/client';
import { esVigente, toPresupuestoDTO } from './presupuesto.dto.js';

const base = (over: Partial<PresupuestoRow>): PresupuestoRow =>
  ({
    id: 'p1',
    tipo: 'INDIVIDUAL',
    periodicidad: 'PERIODICO',
    intervalo: 'MENSUAL',
    fecha_inicio: new Date('2026-01-01'),
    fecha_fin: new Date('2026-01-31'),
    ingresos_esperados: new Prisma.Decimal(100),
    gastos_esperados: null,
    ahorro_esperado: null,
    estado: null,
    usuario_id: 'u1',
    hogar_id: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...over,
  }) as PresupuestoRow;

describe('esVigente', () => {
  it('ESPECIFICO: vigente sii estado === ACTIVO', () => {
    expect(esVigente(base({ periodicidad: 'ESPECIFICO', estado: 'ACTIVO' }))).toBe(true);
    expect(esVigente(base({ periodicidad: 'ESPECIFICO', estado: 'CERRADO' }))).toBe(false);
  });

  it('PERIODICO: vigente sii hoy cae dentro del intervalo', () => {
    const p = base({ fecha_inicio: new Date('2026-06-01'), fecha_fin: new Date('2026-06-30') });
    expect(esVigente(p, new Date('2026-06-15'))).toBe(true);
    expect(esVigente(p, new Date('2026-05-31'))).toBe(false);
    expect(esVigente(p, new Date('2026-07-01'))).toBe(false);
  });

  it('PERIODICO sin fechas: siempre vigente', () => {
    expect(esVigente(base({ fecha_inicio: null, fecha_fin: null }), new Date('2050-01-01'))).toBe(true);
  });
});

describe('toPresupuestoDTO', () => {
  it('mapea columnas a camelCase y fechas a YYYY-MM-DD', () => {
    const dto = toPresupuestoDTO(base({ gastos_esperados: new Prisma.Decimal(50) }));
    expect(dto).toMatchObject({
      id: 'p1',
      tipo: 'INDIVIDUAL',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-01-31',
      ingresosEsperados: 100,
      gastosEsperados: 50,
      ahorroEsperado: null,
    });
  });
});
