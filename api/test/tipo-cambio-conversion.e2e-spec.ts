import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 13 — Tipos de cambio (comando #53), evento CONVERSION y total consolidado
 * en la moneda del hogar (REQUISITES §514–532).
 */
describe('Tipos de cambio y CONVERSION (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let hogarId: string;
  let cuentaUsd: string;
  let cuentaClp: string;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado, notificacion, idempotencia, tipo_cambio RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'fx@e2e.cl', nombre: 'FX', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'fx@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    hogarId = (await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201))
      .body.id;
    cuentaUsd = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'USD', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1000, moneda: 'USD', participaConsolidacion: true })
        .expect(201)
    ).body.id;
    cuentaClp = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'CLP', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'CLP', participaConsolidacion: true })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('RegistrarTipoCambio: valida monedas y rechaza duplicados', async () => {
    await auth(request(http).post('/comandos/RegistrarTipoCambio'))
      .send({ monedaOrigen: 'USD', monedaDestino: 'USD', tasa: 1, fechaVigencia: '2026-01-01' })
      .expect(400);
    await auth(request(http).post('/comandos/RegistrarTipoCambio'))
      .send({ monedaOrigen: 'USD', monedaDestino: 'CLP', tasa: 950, fechaVigencia: '2026-01-01' })
      .expect(201);
    await auth(request(http).post('/comandos/RegistrarTipoCambio'))
      .send({ monedaOrigen: 'USD', monedaDestino: 'CLP', tasa: 960, fechaVigencia: '2026-01-01' })
      .expect(409);
    await auth(request(http).post('/comandos/RegistrarTipoCambio'))
      .send({ monedaOrigen: 'USD', monedaDestino: 'CLP', tasa: 1000, fechaVigencia: '2026-06-01' })
      .expect(201);
  });

  it('CONVERSION mueve ambos lados usando la tasa vigente a la fecha', async () => {
    const conv = await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({
        tipo: 'CONVERSION',
        monto: 500,
        moneda: 'USD',
        elementoOrigenId: cuentaUsd,
        elementoDestinoId: cuentaClp,
        fecha: '2026-07-01',
      })
      .expect(201);
    expect(conv.body.tipo).toBe('CONVERSION');

    const usd = await auth(request(http).get(`/elementos-patrimoniales/${cuentaUsd}`)).expect(200);
    const clp = await auth(request(http).get(`/elementos-patrimoniales/${cuentaClp}`)).expect(200);
    expect(usd.body.valorVigente).toBe(500); // 1000 − 500
    expect(clp.body.valorVigente).toBe(500_000); // 500 USD × 1000
  });

  it('CONVERSION exige monedas distintas y una tasa disponible', async () => {
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'CONVERSION', monto: 10, moneda: 'USD', elementoOrigenId: cuentaUsd, elementoDestinoId: cuentaUsd })
      .expect(400);

    const eur = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'EUR', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'EUR' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'CONVERSION', monto: 10, moneda: 'USD', elementoOrigenId: cuentaUsd, elementoDestinoId: eur, fecha: '2026-07-01' })
      .expect(400); // no hay USD→EUR
  });

  it('patrimonio-consolidado entrega el total en la moneda del hogar', async () => {
    const c = await auth(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200);
    expect(c.body.monedaConsolidacion).toBe('CLP');
    expect(c.body.conversionesFaltantes).toEqual([]);
    // USD 500 × 1000 (tasa 2026-06-01, la más reciente ≤ hoy) + CLP 500.000 = 1.000.000
    expect(c.body.total).toBe(1_000_000);
  });

  it('sin tasa para una moneda, el total queda null y se listan las faltantes', async () => {
    await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
      .send({ nombre: 'GBP', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 100, moneda: 'GBP', participaConsolidacion: true })
      .expect(201);
    const c = await auth(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200);
    expect(c.body.total).toBeNull();
    expect(c.body.conversionesFaltantes).toContain('GBP');
  });

  it('el inverso se usa cuando no hay par directo', async () => {
    const lista = await auth(request(http).get('/tipos-cambio?origen=USD&destino=CLP')).expect(200);
    expect(lista.body.length).toBe(2);
  });
});
