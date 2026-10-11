import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aportesComoPases, pasesConPersonas, quedaDelMes, type MovimientoConPersona } from './flujoMes.ts';

const demo = { usuarioId: 'd', nombre: 'Demo' };
const mov = (over: Partial<MovimientoConPersona> = {}): MovimientoConPersona => ({
  tipo: 'TRANSFERENCIA',
  moneda: 'CLP',
  efectoPropio: -10_000,
  contraparte: demo,
  ...over,
});

test('suma lo que le pasaste a cada persona y aparte lo que te pasó', () => {
  const p = pasesConPersonas(
    [mov(), mov({ efectoPropio: -30_000 }), mov({ efectoPropio: 15_000 }), mov({ contraparte: null, efectoPropio: 0 })],
    'CLP',
  );
  assert.deepEqual(p, [
    { usuarioId: 'd', nombre: 'Demo', monto: -40_000 },
    { usuarioId: 'd', nombre: 'Demo', monto: 15_000 },
  ]);
});

test('ignora gastos, otra moneda y transferencias entre tus cuentas', () => {
  const p = pasesConPersonas(
    [mov({ tipo: 'GASTO', efectoPropio: null }), mov({ moneda: 'USD' }), mov({ contraparte: null })],
    'CLP',
  );
  assert.deepEqual(p, []);
});

test('te queda del mes: entró − gastaste − lo que pasaste + lo que te pasaron', () => {
  const p = pasesConPersonas([mov({ efectoPropio: -105_000 })], 'CLP');
  assert.equal(quedaDelMes(880_000, 0, p), 775_000);
});

test('G45 H2: aportes del hogar como pases (salidas primero), solo en la moneda pedida', () => {
  const p = aportesComoPases(
    [
      { usuarioId: 'd', nombre: 'Demo', moneda: 'CLP', entro: 50_000, salio: 5_000 },
      { usuarioId: 'p', nombre: 'Pareja', moneda: 'CLP', entro: 20_000, salio: 0 },
      { usuarioId: 'd', nombre: 'Demo', moneda: 'USD', entro: 100, salio: 0 },
    ],
    'CLP',
  );
  assert.deepEqual(p, [
    { usuarioId: 'd', nombre: 'Demo', monto: -5_000 },
    { usuarioId: 'p', nombre: 'Pareja', monto: 20_000 },
    { usuarioId: 'd', nombre: 'Demo', monto: 50_000 },
  ]);
  // Les queda: entró − gastaron + lo que entró al hogar − lo que salió.
  assert.equal(quedaDelMes(100_000, 17_000, p), 148_000);
});
