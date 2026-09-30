import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PatrimonioConsolidadoDTO } from './api/client';
import { heroHogar } from './heroHogar.ts';

const fila = (moneda: string, patrimonioNeto: number) => ({
  moneda,
  patrimonioNeto,
  activos: patrimonioNeto,
  pasivos: 0,
  valorLiquido: 0,
});

const consolidado = (p: Partial<PatrimonioConsolidadoDTO>): PatrimonioConsolidadoDTO => ({
  hogarId: 'h1',
  monedaConsolidacion: 'CLP',
  porMoneda: [],
  elementos: 0,
  miembros: 2,
  total: 0,
  conversionesFaltantes: [],
  ...p,
});

test('endpoint falla → error visible, no un 0', () => {
  const r = heroHogar(null, 'HTTP 500', 'CLP');
  assert.equal(r.tipo, 'error');
  assert.match(r.tipo === 'error' ? r.mensaje : '', /HTTP 500/);
});

test('sin respuesta y sin mensaje → error visible', () => {
  assert.equal(heroHogar(null, null, 'CLP').tipo, 'error');
});

test('total disponible → se muestra tal cual', () => {
  const r = heroHogar(consolidado({ total: 13_805_559 }), null, 'CLP');
  assert.deepEqual(r, { tipo: 'total', monto: 13_805_559, moneda: 'CLP' });
});

test('total 0 real (nada consolida) → 0, no error', () => {
  assert.deepEqual(heroHogar(consolidado({ total: 0 }), null, 'CLP'), { tipo: 'total', monto: 0, moneda: 'CLP' });
});

test('falta tipo de cambio → usa la moneda del hogar, no porMoneda[0]', () => {
  const r = heroHogar(
    consolidado({
      total: null,
      porMoneda: [fila('ARS', 0), fila('CLP', 500_000)],
      conversionesFaltantes: ['ARS'],
    }),
    null,
    'CLP',
  );
  assert.deepEqual(r, { tipo: 'parcial', monto: 500_000, moneda: 'CLP', faltantes: ['ARS'] });
});

test('falta tipo de cambio y no hay nada en la moneda del hogar → error, no 0', () => {
  const r = heroHogar(
    consolidado({ total: null, porMoneda: [fila('ARS', 0)], conversionesFaltantes: ['ARS'] }),
    null,
    'CLP',
  );
  assert.equal(r.tipo, 'error');
  assert.match(r.tipo === 'error' ? r.mensaje : '', /ARS/);
});
