import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { PUSH_SENDER, type PushSender } from './../src/notificacion/push-sender.js';

const pushEnviados: { tokens: string[]; titulo: string }[] = [];
const pushSpy: PushSender = {
  async enviar(tokens, titulo) {
    pushEnviados.push({ tokens, titulo });
    return [];
  },
};

/**
 * Fase 11 — Notificaciones in-app (Principio 4 del DDD). No son dominio: se
 * generan como consecuencia de políticas y comandos, sin auditoría propia.
 */
describe('Notificaciones (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA: string;
  let tokenB: string;

  const A = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
  const B = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PUSH_SENDER)
      .useValue(pushSpy)
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado, notificacion, dispositivo_push RESTART IDENTITY CASCADE',
    );
    const reg = async (email: string) => {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre: email, password: 'secret123' })
        .expect(201);
      return (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body
        .accessToken as string;
    };
    tokenA = await reg('na@e2e.cl');
    tokenB = await reg('nb@e2e.cl');
  });

  afterAll(async () => {
    await app.close();
  });

  it('InvitarMiembro notifica al invitado', async () => {
    const hogarId = (
      await A(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)
    ).body.id;
    await A(request(http).post('/comandos/InvitarMiembro'))
      .send({ hogarId, emailInvitado: 'nb@e2e.cl' })
      .expect(201);

    const noLeidas = await B(request(http).get('/usuarios/me/notificaciones/no-leidas')).expect(200);
    expect(noLeidas.body.noLeidas).toBe(1);
    const lista = await B(request(http).get('/usuarios/me/notificaciones')).expect(200);
    expect(lista.body[0]).toMatchObject({ tipo: 'INVITACION_RECIBIDA', leida: false });
    // el emisor no recibe nada
    expect(
      (await A(request(http).get('/usuarios/me/notificaciones/no-leidas')).expect(200)).body.noLeidas,
    ).toBe(0);
  });

  it('completar un objetivo (política) notifica a su dueño', async () => {
    const cuenta = (
      await A(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'C', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 5_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    const objId = (
      await A(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Meta', montoObjetivo: 1_000_000 })
        .expect(201)
    ).body.id;
    const asgId = (
      await A(request(http).post('/comandos/CrearAsignacion')).send({ nombre: 'a', objetivoId: objId }).expect(201)
    ).body.id;
    await A(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId: asgId, elementoOrigenId: cuenta, monto: 1_000_000 })
      .expect(201);

    const objetivos = await A(request(http).get('/usuarios/me/notificaciones?leida=false')).expect(200);
    expect(objetivos.body.some((n: { tipo: string }) => n.tipo === 'OBJETIVO_COMPLETADO')).toBe(true);
  });

  it('marcar una y marcar todas', async () => {
    const lista = (await A(request(http).get('/usuarios/me/notificaciones')).expect(200)).body;
    await A(request(http).post(`/usuarios/me/notificaciones/${lista[0].id}/leer`)).expect(200);
    const todas = await A(request(http).post('/usuarios/me/notificaciones/leer-todas')).expect(200);
    expect(todas.body.marcadas).toBeGreaterThanOrEqual(0);
    expect(
      (await A(request(http).get('/usuarios/me/notificaciones/no-leidas')).expect(200)).body.noLeidas,
    ).toBe(0);
  });

  it('no puedo marcar una notificación ajena', async () => {
    const bLista = (await B(request(http).get('/usuarios/me/notificaciones')).expect(200)).body;
    await A(request(http).post(`/usuarios/me/notificaciones/${bLista[0].id}/leer`)).expect(403);
  });

  it('las notificaciones no generan filas de auditoría', async () => {
    const audit = await prisma.auditoria.count({ where: { comando: { contains: 'Notificacion' } } });
    expect(audit).toBe(0);
  });

  it('con un dispositivo registrado, una notificación dispara un push', async () => {
    await B(request(http).post('/usuarios/me/dispositivos-push'))
      .send({ expoPushToken: 'ExponentPushToken[abc123def456]' })
      .expect(200);
    pushEnviados.length = 0;

    // A invita a B otra vez a un hogar nuevo → notificación INVITACION_RECIBIDA a B
    const hogarId = (
      await A(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa 2' }).expect(201)
    ).body.id;
    await A(request(http).post('/comandos/InvitarMiembro'))
      .send({ hogarId, emailInvitado: 'nb@e2e.cl' })
      .expect(201);

    // el push es best-effort y asíncrono
    await new Promise((r) => setTimeout(r, 100));
    expect(pushEnviados.length).toBeGreaterThanOrEqual(1);
    expect(pushEnviados[0].tokens).toContain('ExponentPushToken[abc123def456]');
  });

  it('olvidar el dispositivo lo quita', async () => {
    await B(request(http).delete('/usuarios/me/dispositivos-push'))
      .send({ expoPushToken: 'ExponentPushToken[abc123def456]' })
      .expect(200);
    expect(
      await prisma.dispositivo_push.count({ where: { expo_push_token: 'ExponentPushToken[abc123def456]' } }),
    ).toBe(0);
  });
});
