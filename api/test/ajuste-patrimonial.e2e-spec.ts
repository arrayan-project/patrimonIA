import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/** Fase 5a — Ajuste Patrimonial (AS #20/#21/#22): mecanismo de excepción. */
describe('Ajuste Patrimonial (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let elId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const valor = async () =>
    (await auth(request(http).get(`/elementos-patrimoniales/${elId}`))).body.valorVigente;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'aj@e2e.cl', nombre: 'Aj', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'aj@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    elId = (
      await auth(
        request(http).post('/comandos/RegistrarElementoPatrimonial').send({
          nombre: 'Caja',
          tipo: 'efectivo',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 100_000,
          moneda: 'CLP',
        }),
      ).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige motivo', async () => {
    await auth(
      request(http).post('/comandos/RegistrarAjustePatrimonial').send({ elementoId: elId, monto: 500 }),
    ).expect(400);
  });

  it('registra un ajuste negativo y ajusta el valor vigente', async () => {
    const ajuste = await auth(
      request(http)
        .post('/comandos/RegistrarAjustePatrimonial')
        .send({ elementoId: elId, monto: -3_000, motivo: 'faltaba plata en la caja' }),
    ).expect(201);
    expect(ajuste.body.monto).toBe(-3_000);
    expect(await valor()).toBe(97_000);

    const entrada = await prisma.auditoria.findFirst({
      where: { comando: 'RegistrarAjustePatrimonial' },
    });
    expect(entrada?.motivo).toBe('faltaba plata en la caja');
  });

  it('corrige el ajuste compensando el monto', async () => {
    const historial = await auth(
      request(http).get(`/ajustes-patrimoniales?elemento=${elId}`),
    ).expect(200);
    const ajuste = historial.body.find((a: { monto: number }) => a.monto === -3_000);

    const correccion = await auth(
      request(http)
        .post('/comandos/CorregirAjustePatrimonial')
        .send({ ajusteId: ajuste.id, nuevoMonto: -2_500, motivo: 'eran 2.500' }),
    ).expect(201);
    expect(correccion.body.monto).toBe(500); // −2500 − (−3000)
    expect(correccion.body.correccionDeId).toBe(ajuste.id);
    expect(await valor()).toBe(97_500);

    await auth(
      request(http)
        .post('/comandos/CorregirAjustePatrimonial')
        .send({ ajusteId: ajuste.id, nuevoMonto: -1_000, motivo: 'otra vez' }),
    ).expect(409);
  });

  it('anula un ajuste y revierte su efecto', async () => {
    const base = await valor();
    const ajuste = await auth(
      request(http)
        .post('/comandos/RegistrarAjustePatrimonial')
        .send({ elementoId: elId, monto: 8_000, motivo: 'apareció plata' }),
    ).expect(201);
    expect(await valor()).toBe(base + 8_000);

    await auth(
      request(http)
        .post('/comandos/AnularAjustePatrimonial')
        .send({ ajusteId: ajuste.body.id, motivo: 'me equivoqué de cuenta' }),
    ).expect(200);
    expect(await valor()).toBe(base);
  });
});
