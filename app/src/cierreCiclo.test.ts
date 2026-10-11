import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cicloAnterior, claveCiclo, enDiasDeCierre, mostrarCierre } from './cierreCiclo.ts';

const base = { hoyISO: '2026-10-02', desdeISO: '2026-10-01', sobrante: 1_105_510, clave: '2026-10', cierreVisto: null };

test('clave AAAA-MM y ciclo anterior (cruza el año)', () => {
  assert.equal(claveCiclo(2026, 9), '2026-10');
  assert.equal(claveCiclo(2026, 0), '2026-01');
  assert.deepEqual(cicloAnterior(2026, 0), { anio: 2025, mes: 11 });
  assert.deepEqual(cicloAnterior(2026, 9), { anio: 2026, mes: 8 });
});

test('ventana de 7 días: del día 1 al 7 del ciclo, no antes ni después', () => {
  assert.equal(enDiasDeCierre('2026-10-01', '2026-10-01'), true);
  assert.equal(enDiasDeCierre('2026-10-07', '2026-10-01'), true);
  assert.equal(enDiasDeCierre('2026-10-08', '2026-10-01'), false);
  assert.equal(enDiasDeCierre('2026-09-30', '2026-10-01'), false);
  // Ciclo que parte el 25 (G43): el 27 es el día 3.
  assert.equal(enDiasDeCierre('2026-10-27', '2026-10-25'), true);
});

test('se muestra con sobrante en el ciclo anterior, en los primeros días', () => {
  assert.equal(mostrarCierre(base), true);
});

test('no se muestra sin sobrante (0 o negativo)', () => {
  assert.equal(mostrarCierre({ ...base, sobrante: 0 }), false);
  assert.equal(mostrarCierre({ ...base, sobrante: -5_000 }), false);
});

test('no vuelve si ya se vio en este ciclo; sí en el siguiente', () => {
  assert.equal(mostrarCierre({ ...base, cierreVisto: '2026-10' }), false);
  assert.equal(mostrarCierre({ ...base, cierreVisto: '2026-09' }), true);
});

test('fuera de la ventana no se muestra aunque haya sobrante', () => {
  assert.equal(mostrarCierre({ ...base, hoyISO: '2026-10-11' }), false);
});
