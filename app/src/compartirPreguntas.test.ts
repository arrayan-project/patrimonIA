import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asiLoVe,
  esAMedida,
  guardadoDe,
  preguntaTransferir,
  respuestaCorta,
  respuestasDe,
  type CuentaCompartible,
  type NivelesPorTipo,
} from './compartirPreguntas.ts';

const cuenta = (niveles: NivelesPorTipo, consolida: boolean, over: Partial<CuentaCompartible> = {}): CuentaCompartible => ({
  participaConsolidacion: consolida,
  visibilidad: 'PRIVADA',
  visibilidadPorTipo: { ...niveles },
  ...over,
});

// Los 4 niveles de D-2 (compartirHogar.ts) y su equivalencia en preguntas.
const NIVELES = {
  nada: { n: { EXISTENCIA: 'PRIVADA', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' }, c: false, r: { hogar: false, movimientos: false, transferir: false } },
  transferir: { n: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' }, c: false, r: { hogar: false, movimientos: false, transferir: true } },
  saldo: { n: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'PRIVADA' }, c: true, r: { hogar: true, movimientos: false, transferir: true } },
  todo: { n: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'FAMILIAR' }, c: true, r: { hogar: true, movimientos: true, transferir: true } },
} as const;

for (const [nombre, { n, c, r }] of Object.entries(NIVELES)) {
  test(`equivalencia "${nombre}": se lee como sus respuestas y se guarda igual`, () => {
    const el = cuenta(n as NivelesPorTipo, c);
    assert.deepEqual(respuestasDe(el), r);
    assert.deepEqual(guardadoDe(r), { niveles: n, consolida: c });
    assert.equal(esAMedida(el), false);
  });
}

test('una combinación de Avanzado (suma al hogar con el saldo privado) es "a tu medida"', () => {
  const el = cuenta({ EXISTENCIA: 'PRIVADA', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' }, true);
  assert.equal(esAMedida(el), true);
  assert.deepEqual(respuestasDe(el), { hogar: true, movimientos: false, transferir: false });
});

test('🔁 solo en las del día a día (o si ya está en Sí), y nunca si es del hogar', () => {
  const no = { hogar: false, movimientos: false, transferir: false };
  assert.equal(preguntaTransferir(true, no), true);
  assert.equal(preguntaTransferir(false, no), false);
  assert.equal(preguntaTransferir(false, { ...no, transferir: true }), true);
  assert.equal(preguntaTransferir(true, NIVELES.todo.r), false);
});

test('respuesta corta y "Así lo ve": dicen el número, los movimientos y si suma', () => {
  assert.equal(respuestaCorta(NIVELES.saldo.r), '🏠 Del hogar · 🔒 movimientos privados');
  assert.equal(respuestaCorta(NIVELES.nada.r), '🙋 Solo tuya');
  const ve = asiLoVe(NIVELES.saldo.r, { nombre: 'Cuenta RUT', saldo: '100.000 CLP' }, 'Zoily').map((l) => l.texto);
  assert.deepEqual(ve, [
    'Ve el saldo de Cuenta RUT: 100.000 CLP',
    'Ve sus movimientos solo como "Movimientos privados de Zoily"',
    'Suma a "Plata del hogar"',
  ]);
  assert.equal(asiLoVe(NIVELES.nada.r, { nombre: 'Cuenta RUT', saldo: '' }, 'Zoily')[0].texto, 'No ve Cuenta RUT');
});
