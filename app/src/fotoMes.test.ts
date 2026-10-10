import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparFoto, cuentasDelDia, rotuloLinea } from './fotoMes.ts';

const cuenta = (id: string, categoriaFuncional: string, tipo = 'x', estado = 'ACTIVO') => ({ id, categoriaFuncional, tipo, estado });
const els = [
  cuenta('chile', 'LIQUIDEZ', 'Cuenta corriente'),
  cuenta('bci', 'RESERVA', 'Cuenta de ahorro'),
  cuenta('visa', 'DEUDA', 'Tarjeta de crédito'),
  cuenta('hipoteca', 'DEUDA', 'Crédito hipotecario'),
  cuenta('casa', 'ACTIVO', 'Propiedad'),
  cuenta('vieja', 'LIQUIDEZ', 'Cuenta vista', 'INACTIVO'),
];

test('sin elegir: tus cuentas de uso diario y tus tarjetas', () => {
  assert.deepEqual(cuentasDelDia(els, null), ['chile', 'visa']);
});

test('lo elegido manda, sin las que ya no están activas', () => {
  assert.deepEqual(cuentasDelDia(els, ['bci', 'vieja', 'casa']), ['bci']);
});

test('entró y salió cuadran con las líneas', () => {
  const g = agruparFoto([
    { clase: 'INGRESO', monto: 2_000_000, persona: null },
    { clase: 'GASTO', monto: -50_000, persona: null },
    { clase: 'OTRAS', monto: 100_000, persona: null },
    { clase: 'INVERSION', monto: -200_000, persona: null },
  ]);
  assert.equal(g.entro, 2_100_000);
  assert.equal(g.salio, 250_000);
  assert.deepEqual(g.lineasSalio.map((l) => l.clase), ['INVERSION', 'GASTO']);
});

test('cada línea dice qué pasó con la plata', () => {
  assert.equal(rotuloLinea({ clase: 'AHORRO', monto: -1, persona: null }), '🐷 Ahorraste');
  assert.equal(rotuloLinea({ clase: 'OTRAS', monto: 1, persona: null }), '🔁 Trajiste de tus otras cuentas');
  assert.equal(rotuloLinea({ clase: 'PERSONA', monto: -1, persona: { usuarioId: 'z', nombre: 'Zoily' } }), '👤 Le pasaste a Zoily');
});
