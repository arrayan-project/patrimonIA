import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 3 — Flujo 6 (UX_FLOWS): un gasto mal registrado se corrige y se anula.
 * Patrón de corrección (DDD Sección T): el original queda intacto, la corrección
 * es un evento compensatorio enlazado; anular revierte el efecto y marca el flag.
 */
describe('Flujo 6 — corregir / anular un movimiento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let elementoId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const valorVigente = async () =>
    (await auth(request(http).get(`/elementos-patrimoniales/${elementoId}`))).body.valorVigente;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();

    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'ele@e2e.cl', nombre: 'Ele', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'ele@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    elementoId = (
      await auth(
        request(http).post('/comandos/RegistrarElementoPatrimonial').send({
          nombre: 'Cuenta',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 0,
          moneda: 'CLP',
        }),
      ).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('corrige un gasto de 50.000 a 45.000 con un evento compensatorio', async () => {
    const gasto = await auth(
      request(http)
        .post('/comandos/RegistrarEventoFinanciero')
        .send({ tipo: 'GASTO', monto: 50_000, moneda: 'CLP', elementoOrigenId: elementoId }),
    ).expect(201);
    expect(await valorVigente()).toBe(-50_000);

    const correccion = await auth(
      request(http)
        .post('/comandos/CorregirEventoFinanciero')
        .send({ eventoId: gasto.body.id, nuevoMonto: 45_000, motivo: 'el monto real era 45k' }),
    ).expect(201);

    expect(correccion.body.tipo).toBe('GASTO');
    expect(correccion.body.monto).toBe(5_000); // compensa la diferencia
    expect(correccion.body.correccionDeId).toBe(gasto.body.id);
    expect(await valorVigente()).toBe(-45_000);

    // El original sigue intacto e inmutable
    const original = await auth(
      request(http).get(`/eventos-financieros/${gasto.body.id}`),
    ).expect(200);
    expect(original.body.monto).toBe(50_000);
    expect(original.body.anulado).toBe(false);

    // No se puede corregir dos veces el mismo evento
    await auth(
      request(http)
        .post('/comandos/CorregirEventoFinanciero')
        .send({ eventoId: gasto.body.id, nuevoMonto: 40_000, motivo: 'otra vez' }),
    ).expect(409);

    // Auditoría: Corrección apunta al original y al compensatorio
    const entrada = await prisma.auditoria.findFirst({
      where: { comando: 'CorregirEventoFinanciero' },
    });
    expect(entrada?.entidad_id).toBe(gasto.body.id);
    expect(entrada?.entidad_relacionada_id).toBe(correccion.body.id);
    expect(entrada?.motivo).toBe('el monto real era 45k');
    expect(entrada?.valor_anterior).toEqual({ monto: 50_000 });
    expect(entrada?.valor_posterior).toEqual({ monto: 45_000 });
  });

  it('anula un ingreso y revierte su efecto', async () => {
    const base = await valorVigente();
    const ingreso = await auth(
      request(http)
        .post('/comandos/RegistrarEventoFinanciero')
        .send({ tipo: 'INGRESO', monto: 20_000, moneda: 'CLP', elementoDestinoId: elementoId }),
    ).expect(201);
    expect(await valorVigente()).toBe(base + 20_000);

    await auth(
      request(http)
        .post('/comandos/AnularEventoFinanciero')
        .send({ eventoId: ingreso.body.id, motivo: 'no ocurrió' }),
    ).expect(200);
    expect(await valorVigente()).toBe(base);

    // Doble anulación → 409
    await auth(
      request(http)
        .post('/comandos/AnularEventoFinanciero')
        .send({ eventoId: ingreso.body.id, motivo: 'otra vez' }),
    ).expect(409);

    // El evento anulado desaparece del historial de impactos del elemento,
    // pero sigue consultable por id con su flag.
    const impactos = await auth(
      request(http).get(`/elementos-patrimoniales/${elementoId}/impactos`),
    ).expect(200);
    expect(impactos.body.some((i: { origenId: string }) => i.origenId === ingreso.body.id)).toBe(
      false,
    );
    const anulado = await auth(
      request(http).get(`/eventos-financieros/${ingreso.body.id}`),
    ).expect(200);
    expect(anulado.body.anulado).toBe(true);
  });

  it('no deja anular un evento que tiene una corrección viva', async () => {
    const gasto = await auth(
      request(http)
        .post('/comandos/RegistrarEventoFinanciero')
        .send({ tipo: 'GASTO', monto: 10_000, moneda: 'CLP', elementoOrigenId: elementoId }),
    ).expect(201);
    await auth(
      request(http)
        .post('/comandos/CorregirEventoFinanciero')
        .send({ eventoId: gasto.body.id, nuevoMonto: 8_000, motivo: 'eran 8k' }),
    ).expect(201);

    await auth(
      request(http)
        .post('/comandos/AnularEventoFinanciero')
        .send({ eventoId: gasto.body.id, motivo: 'quiero borrarlo' }),
    ).expect(409);
  });

  it('exige motivo', async () => {
    const gasto = await auth(
      request(http)
        .post('/comandos/RegistrarEventoFinanciero')
        .send({ tipo: 'GASTO', monto: 1_000, moneda: 'CLP', elementoOrigenId: elementoId }),
    ).expect(201);
    await auth(
      request(http).post('/comandos/AnularEventoFinanciero').send({ eventoId: gasto.body.id }),
    ).expect(400);
  });
});
