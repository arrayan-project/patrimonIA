import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriasMasUsadas, ultimaCuenta, type MovimientoReciente } from './recientes.ts';

const mov = (over: Partial<MovimientoReciente> = {}): MovimientoReciente => ({
  tipo: 'GASTO',
  categoriaId: null,
  elementoOrigenId: 'rut',
  elementoDestinoId: null,
  registradoEn: '2026-10-01T10:00:00.000Z',
  ...over,
});
const todas = () => true;

test('Gasté recuerda la cuenta del último gasto anotado, no la de la fecha más nueva', () => {
  const movs = [
    mov({ elementoOrigenId: 'corriente', registradoEn: '2026-10-05T10:00:00.000Z' }),
    mov({ elementoOrigenId: 'rut', registradoEn: '2026-10-08T10:00:00.000Z' }),
    mov({ tipo: 'INGRESO', elementoOrigenId: null, elementoDestinoId: 'ahorro', registradoEn: '2026-10-09T10:00:00.000Z' }),
  ];
  assert.deepEqual(ultimaCuenta(movs, 'GASTO', todas), { origenId: 'rut', destinoId: null });
  assert.deepEqual(ultimaCuenta(movs, 'INGRESO', todas), { origenId: null, destinoId: 'ahorro' });
});

test('si la última cuenta ya no se ofrece, se usa la anterior', () => {
  const movs = [
    mov({ elementoOrigenId: 'cerrada', registradoEn: '2026-10-08T10:00:00.000Z' }),
    mov({ elementoOrigenId: 'rut', registradoEn: '2026-10-02T10:00:00.000Z' }),
  ];
  assert.deepEqual(ultimaCuenta(movs, 'GASTO', (id) => id !== 'cerrada'), { origenId: 'rut', destinoId: null });
  assert.equal(ultimaCuenta(movs, 'GASTO', () => false), null);
});

test('Moví plata recuerda el par completo, también de un cambio de moneda', () => {
  const movs = [
    mov({ tipo: 'TRANSFERENCIA', elementoOrigenId: 'corriente', elementoDestinoId: 'rut', registradoEn: '2026-10-01T10:00:00.000Z' }),
    mov({ tipo: 'CONVERSION', elementoOrigenId: 'corriente', elementoDestinoId: 'usd', registradoEn: '2026-10-03T10:00:00.000Z' }),
  ];
  assert.deepEqual(ultimaCuenta(movs, 'TRANSFERENCIA', todas), { origenId: 'corriente', destinoId: 'usd' });
  // Si una de las dos no se ofrece, se busca un par anterior que sí sirva.
  assert.deepEqual(ultimaCuenta(movs, 'TRANSFERENCIA', (id) => id !== 'usd'), { origenId: 'corriente', destinoId: 'rut' });
});

test('una transferencia que te hizo alguien del hogar no deja su cuenta como salida', () => {
  const movs = [
    mov({ tipo: 'TRANSFERENCIA', elementoOrigenId: 'deLaPareja', elementoDestinoId: 'rut', registradoEn: '2026-10-08T10:00:00.000Z' }),
    mov({ tipo: 'TRANSFERENCIA', elementoOrigenId: 'rut', elementoDestinoId: 'deLaPareja', registradoEn: '2026-10-02T10:00:00.000Z' }),
  ];
  const propias = new Set(['rut', 'corriente']);
  const valida = (id: string, lado: 'origen' | 'destino') => propias.has(id) || (lado === 'destino' && id === 'deLaPareja');
  assert.deepEqual(ultimaCuenta(movs, 'TRANSFERENCIA', valida), { origenId: 'rut', destinoId: 'deLaPareja' });
});

test('sin movimientos de esa puerta, no recuerda nada', () => {
  assert.equal(ultimaCuenta([mov()], 'TRANSFERENCIA', todas), null);
  assert.equal(ultimaCuenta([], 'GASTO', todas), null);
});

test('categorías más usadas: por cantidad y, a igual uso, la más reciente primero', () => {
  const movs = [
    mov({ categoriaId: 'comida', registradoEn: '2026-10-01T10:00:00.000Z' }),
    mov({ categoriaId: 'comida', registradoEn: '2026-10-02T10:00:00.000Z' }),
    mov({ categoriaId: 'bencina', registradoEn: '2026-10-03T10:00:00.000Z' }),
    mov({ categoriaId: 'luz', registradoEn: '2026-10-07T10:00:00.000Z' }),
    mov({ categoriaId: 'farmacia', registradoEn: '2026-10-05T10:00:00.000Z' }),
    mov({ categoriaId: 'cine', registradoEn: '2026-09-01T10:00:00.000Z' }),
    mov({ categoriaId: null }),
    mov({ tipo: 'INGRESO', categoriaId: 'sueldo' }),
  ];
  assert.deepEqual(categoriasMasUsadas(movs, 'GASTO', todas), ['comida', 'luz', 'farmacia', 'bencina']);
  assert.deepEqual(categoriasMasUsadas(movs, 'INGRESO', todas), ['sueldo']);
  assert.deepEqual(categoriasMasUsadas(movs, 'GASTO', (id) => id !== 'comida', 2), ['luz', 'farmacia']);
});
