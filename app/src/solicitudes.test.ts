import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filasEntre, nombres, parteIgual, tituloSolicitud, type SolicitudDTO } from './solicitudes.ts';

const fmt = (n: number, m: string) => `${n} ${m}`;

const sol = (over: Partial<SolicitudDTO> = {}): SolicitudDTO => ({
  id: 's1',
  motivo: 'GASTO_COMPARTIDO',
  estado: 'PENDIENTE',
  direccion: 'RECIBIDA',
  solicitante: { id: 'a', nombre: 'Juan' },
  destinatario: { id: 'b', nombre: 'Zoily' },
  monto: 30000,
  moneda: 'CLP',
  cuentaDestino: { id: 'cA', nombre: 'Cuenta Juan' },
  cuentaDisponible: true,
  fecha: '2026-03-20',
  glosa: 'Supermercado',
  totalGasto: 60000,
  eventoGastoId: 'g1',
  eventoPagoId: null,
  createdAt: '2026-03-20T10:00:00Z',
  ...over,
});

test('partes iguales hacia abajo: lo que sobra lo pone quien pagó', () => {
  assert.equal(parteIgual(60000, 1, 'CLP'), 30000);
  assert.equal(parteIgual(60001, 1, 'CLP'), 30000);
  assert.equal(parteIgual(100, 2, 'CLP'), 33);
  assert.equal(parteIgual(100, 2, 'USD'), 33.33);
});

test('nombres en una frase', () => {
  assert.equal(nombres(['Juan']), 'Juan');
  assert.equal(nombres(['Juan', 'Nico', 'Ana']), 'Juan, Nico y Ana');
});

test('el título depende de quién mira', () => {
  assert.equal(tituloSolicitud(sol()), 'Juan te pidió tu parte de Supermercado');
  assert.equal(tituloSolicitud(sol({ direccion: 'ENVIADA' })), 'Le pediste a Zoily su parte de Supermercado');
  assert.equal(
    tituloSolicitud(sol({ motivo: 'SIN_ANOTAR', glosa: null })),
    'Juan te pidió anotar una transferencia',
  );
});

test('Entre ustedes: solicitudes y transferencias con miembros, sin repetir el pago', () => {
  const tx = (eventoId: string, fecha: string, direccion: 'ENVIADA' | 'RECIBIDA') => ({
    eventoId,
    direccion,
    miembro: { id: 'a', nombre: 'Juan' },
    cuentaPropia: { id: 'cB', nombre: 'Cuenta Zoily' },
    monto: 5000,
    moneda: 'CLP',
    fecha,
    glosa: null,
  });
  const filas = filasEntre(
    [sol({ estado: 'PAGADA', eventoPagoId: 'pago' })],
    [tx('pago', '2026-03-21', 'ENVIADA'), tx('t1', '2026-03-22', 'RECIBIDA')],
    fmt,
  );
  assert.deepEqual(
    filas.map((f) => [f.titulo, f.detalle, f.positivo]),
    [
      ['Juan te transfirió', 'Cuenta Zoily · 2026-03-22', true],
      ['Supermercado', 'Te pidió Juan · Pagado · 2026-03-20', false],
    ],
  );
  assert.equal(filas[1].solicitudId, undefined);
});
