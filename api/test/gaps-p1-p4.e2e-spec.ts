import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * GAPS.md P1–P4 (Fase 36):
 *  P1 (G3)  — moneda de consolidación en CrearHogar + CambiarMonedaConsolidacion.
 *  P2 (G14) — anular un evento revierte las reservas que consumió.
 *  P3 (G11) — CambiarAdmiteValorizacion después de crear el elemento.
 *  P4 (G20) — silenciar un tipo de notificación desde preferencias.
 */
describe('GAPS P1–P4 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token = '';

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, notificacion RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'g@e2e.cl', nombre: 'G', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'g@e2e.cl', password: 'secret123' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('P1 — CrearHogar guarda la moneda y CambiarMonedaConsolidacion la cambia', async () => {
    const hogarId = (
      await auth(request(http).post('/comandos/CrearHogar'))
        .send({ nombre: 'Casa', monedaConsolidacion: 'USD' })
        .expect(201)
    ).body.id;
    expect((await auth(request(http).get(`/hogares/${hogarId}`)).expect(200)).body.monedaConsolidacion).toBe('USD');

    await auth(request(http).post('/comandos/CambiarMonedaConsolidacion'))
      .send({ hogarId, moneda: 'EUR' })
      .expect(200);
    expect((await auth(request(http).get(`/hogares/${hogarId}`)).expect(200)).body.monedaConsolidacion).toBe('EUR');
  });

  it('P2 — anular un evento revive las reservas que consumió y sube el progreso', async () => {
    const cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Cuenta', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 2_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    const objetivoId = (
      await auth(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Meta', montoObjetivo: 500_000 })
        .expect(201)
    ).body.id;
    const asignacionId = (
      await auth(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Parte', objetivoId })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: cuentaId, monto: 300_000 })
      .expect(201);

    const eventoId = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 50_000, moneda: 'CLP', elementoOrigenId: cuentaId, asignacionId })
        .expect(201)
    ).body.id;
    // el gasto consumió la reserva → progreso 0
    expect((await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.progreso).toBe(0);
    expect(
      (await prisma.reserva.findFirst({ where: { asignacion_id: asignacionId } }))?.estado,
    ).toBe('CONSUMIDA');

    await auth(request(http).post('/comandos/AnularEventoFinanciero'))
      .send({ eventoId, motivo: 'no ocurrió' })
      .expect(200);

    expect(
      (await prisma.reserva.findFirst({ where: { asignacion_id: asignacionId } }))?.estado,
    ).toBe('ACTIVA');
    expect((await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.progreso).toBe(300_000);
  });

  it('P3 — CambiarAdmiteValorizacion habilita/deshabilita; rechaza en DEUDA', async () => {
    const bienId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Depto', tipo: 'inmueble', categoriaFuncional: 'ACTIVO', valorInicial: 80_000_000, moneda: 'CLP', admiteValorizacion: false })
        .expect(201)
    ).body.id;

    // sin el flag, valorizar falla
    await auth(request(http).post('/comandos/RegistrarValorizacion'))
      .send({ elementoId: bienId, valorNuevo: 85_000_000 })
      .expect(400);

    await auth(request(http).post('/comandos/CambiarAdmiteValorizacion'))
      .send({ elementoId: bienId, admite: true })
      .expect(200);
    await auth(request(http).post('/comandos/RegistrarValorizacion'))
      .send({ elementoId: bienId, valorNuevo: 85_000_000 })
      .expect(201);

    // sin cambios → 400
    await auth(request(http).post('/comandos/CambiarAdmiteValorizacion'))
      .send({ elementoId: bienId, admite: true })
      .expect(400);

    const deudaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Deuda', tipo: 'deuda', categoriaFuncional: 'DEUDA', valorPendiente: 1_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CambiarAdmiteValorizacion'))
      .send({ elementoId: deudaId, admite: true })
      .expect(400);
  });

  it('P4 — un tipo silenciado en preferencias no genera notificación', async () => {
    await auth(request(http).post('/comandos/ActualizarDatosUsuario'))
      .send({ preferencias: { notificaciones: { OBJETIVO_COMPLETADO: false } } })
      .expect(200);

    const cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Ahorro', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    const objetivoId = (
      await auth(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Chico', montoObjetivo: 100_000 })
        .expect(201)
    ).body.id;
    const asignacionId = (
      await auth(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'p', objetivoId })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: cuentaId, monto: 100_000 })
      .expect(201);

    // el objetivo se completó, pero la notificación está silenciada
    expect((await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.estado).toBe('COMPLETADO');
    const notifs = await auth(request(http).get('/usuarios/me/notificaciones')).expect(200);
    expect(notifs.body.some((n: { tipo: string }) => n.tipo === 'OBJETIVO_COMPLETADO')).toBe(false);
  });
});
