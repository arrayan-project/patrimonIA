import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opcionesDePersonas, saldoResultante, saldoTexto } from './personas.ts';

test('el saldo se dice en palabras, sin signo', () => {
  const fmt = (n: number, m: string) => `${n} ${m}`;
  assert.equal(saldoTexto('Noira', 5000, 'CLP', fmt), 'Noira te debe 5000 CLP');
  assert.equal(saldoTexto('Noira', -30000, 'CLP', fmt), 'Le debes 30000 CLP a Noira');
  assert.equal(saldoTexto('Noira', 0, 'CLP', fmt), 'Noira y tú quedan a mano');
});

test('lo que entra baja el saldo y lo que sale lo sube', () => {
  assert.equal(saldoResultante(0, 'ENTRA', 50), -50);
  assert.equal(saldoResultante(-50, 'SALE', 20), -30);
  assert.equal(saldoResultante(30, 'SALE', 20), 50);
});

test('HZ-20: la entrada previa se descuenta antes de la salida', () => {
  assert.equal(saldoResultante(0, 'SALE', 40, { tipo: 'NO_ANOTADA' }), 0);
  assert.equal(saldoResultante(0, 'SALE', 30, { tipo: 'ANOTADA', montoIngreso: 40 }), -10);
  assert.equal(saldoResultante(0, 'SALE', 30, { tipo: 'DEVOLVER' }), 30);
});

test('una opción por persona, con el saldo en la moneda de la cuenta', () => {
  const p = (persona: string, moneda: string, saldo: number) => ({
    persona,
    moneda,
    saldo,
    deudaId: null,
    creditoId: null,
  });
  assert.deepEqual(opcionesDePersonas([p('Rosa', 'CLP', 0), p('Noira', 'USD', -100), p('Noira', 'CLP', 20)], 'CLP'), [
    { nombre: 'Noira', saldo: 20 },
    { nombre: 'Rosa', saldo: 0 },
  ]);
  assert.deepEqual(opcionesDePersonas([p('Noira', 'USD', -100)], 'CLP'), [{ nombre: 'Noira', saldo: 0 }]);
});
