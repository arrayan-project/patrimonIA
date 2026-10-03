import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traducirError } from './errores.ts';

test('traduce un código conocido', () => {
  assert.equal(traducirError('RESERVA_NO_ACTIVA', undefined, 'La reserva no está activa'), 'Ese ahorro ya no está en la meta.');
});

test('usa los datos del error', () => {
  assert.equal(
    traducirError('DISPONIBLE_INSUFICIENTE', { disponible: 1000000, pedido: 2000000 }, 'x'),
    'La cuenta solo tiene $1.000.000 libre para esto.',
  );
});

test('sin código o con uno desconocido deja el mensaje del backend', () => {
  assert.equal(traducirError(undefined, undefined, 'Credenciales inválidas'), 'Credenciales inválidas');
  assert.equal(traducirError('OTRO', undefined, 'Mensaje'), 'Mensaje');
});
