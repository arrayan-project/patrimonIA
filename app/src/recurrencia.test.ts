import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadaCuando, siguienteFecha } from './recurrencia.ts';

test('la siguiente es el mismo día del mes o del año siguiente', () => {
  assert.equal(siguienteFecha('2026-10-05', 'MENSUAL'), '2026-11-05');
  assert.equal(siguienteFecha('2026-12-05', 'MENSUAL'), '2027-01-05');
  assert.equal(siguienteFecha('2026-03-10', 'ANUAL'), '2027-03-10');
});

test('si el mes no tiene ese día, cae en el último', () => {
  assert.equal(siguienteFecha('2026-01-31', 'MENSUAL'), '2026-02-28');
  assert.equal(siguienteFecha('2028-02-29', 'ANUAL'), '2029-02-28');
});

test('cuándo se repite, en palabras', () => {
  assert.equal(cadaCuando('MENSUAL', '2026-02-28', 31), 'el 31 de cada mes');
  assert.equal(cadaCuando('MENSUAL', '2026-10-05'), 'el 5 de cada mes');
  assert.equal(cadaCuando('ANUAL', '2026-03-10'), 'cada 10 de marzo');
});
