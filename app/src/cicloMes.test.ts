import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cicloDe, rotuloCiclo, ventanaCiclo, type CicloMes } from './cicloMes.ts';

const sueldo: CicloMes = { dia: 25, nombre: 'termina' };

test('con el día 1 es el mes calendario', () => {
  assert.deepEqual(ventanaCiclo(2026, 1, { dia: 1, nombre: 'termina' }), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.equal(rotuloCiclo(2026, 1, { dia: 1, nombre: 'empieza' }), null);
});

test('"noviembre" que vives va del 25 de octubre al 24 de noviembre', () => {
  // 25 oct 2026 es domingo: parte el viernes 23. 25 nov es miércoles.
  assert.deepEqual(ventanaCiclo(2026, 10, sueldo), { desde: '2026-10-23', hasta: '2026-11-24' });
  assert.equal(rotuloCiclo(2026, 10, sueldo), '23 oct – 24 nov');
});

test('con el nombre del mes en que empieza, "octubre" es el del sueldo de octubre', () => {
  assert.deepEqual(ventanaCiclo(2026, 9, { dia: 25, nombre: 'empieza' }), { desde: '2026-10-23', hasta: '2026-11-24' });
});

test('el fin de semana corre el inicio al viernes y el mes anterior termina el jueves', () => {
  // 25 abr 2026 es sábado → parte el viernes 24; marzo-abril termina el 23.
  assert.deepEqual(ventanaCiclo(2026, 3, sueldo), { desde: '2026-03-25', hasta: '2026-04-23' });
});

test('el mes de una fecha', () => {
  assert.deepEqual(cicloDe(new Date(2026, 9, 27), sueldo), { anio: 2026, mes: 10 }); // 27 oct → noviembre
  assert.deepEqual(cicloDe(new Date(2026, 9, 23), sueldo), { anio: 2026, mes: 10 }); // viernes 23 ya es noviembre
  assert.deepEqual(cicloDe(new Date(2026, 9, 22), sueldo), { anio: 2026, mes: 9 });
  assert.deepEqual(cicloDe(new Date(2026, 11, 30), sueldo), { anio: 2027, mes: 0 }); // 30 dic → enero
  assert.deepEqual(cicloDe(new Date(2026, 9, 10), { dia: 1, nombre: 'termina' }), { anio: 2026, mes: 9 });
  assert.deepEqual(cicloDe(new Date(2026, 9, 27), { dia: 25, nombre: 'empieza' }), { anio: 2026, mes: 9 });
  assert.deepEqual(cicloDe(new Date(2026, 9, 10), { dia: 25, nombre: 'empieza' }), { anio: 2026, mes: 8 });
});
