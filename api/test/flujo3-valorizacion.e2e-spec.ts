import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 4 — Flujo 3 (UX_FLOWS): registrar un inmueble y valorizarlo en el tiempo.
 * Valorización reemplaza el valor vigente (stock), no lo acumula; la corrección
 * también reemplaza (DDD Sección T).
 */
describe('Flujo 3 — valorización de un activo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let depId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const valorDep = async () =>
    (await auth(request(http).get(`/elementos-patrimoniales/${depId}`))).body.valorVigente;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'casa@e2e.cl', nombre: 'Casa', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'casa@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    depId = (
      await auth(
        request(http).post('/comandos/RegistrarElementoPatrimonial').send({
          nombre: 'Departamento',
          tipo: 'inmueble',
          categoriaFuncional: 'ACTIVO',
          valorInicial: 100_000_000,
          moneda: 'CLP',
          admiteValorizacion: true,
        }),
      ).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza valorizar un elemento que no admite valorización', async () => {
    const cuenta = (
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
    await auth(
      request(http)
        .post('/comandos/RegistrarValorizacion')
        .send({ elementoId: cuenta, valorNuevo: 100 }),
    ).expect(400);
  });

  it('valoriza reemplazando el valor vigente (no acumula)', async () => {
    await auth(
      request(http)
        .post('/comandos/RegistrarValorizacion')
        .send({ elementoId: depId, valorNuevo: 120_000_000 }),
    ).expect(201);
    expect(await valorDep()).toBe(120_000_000);

    await auth(
      request(http)
        .post('/comandos/RegistrarValorizacion')
        .send({ elementoId: depId, valorNuevo: 130_000_000 }),
    ).expect(201);
    expect(await valorDep()).toBe(130_000_000); // reemplaza, no 120M+130M

    const patrimonio = await auth(
      request(http).get('/usuarios/me/patrimonio-individual'),
    ).expect(200);
    expect(patrimonio.body.porMoneda).toEqual([
      { moneda: 'CLP', patrimonio: 130_000_000, valorLiquido: 0 },
    ]);
  });

  it('solo deja anular / corregir la última valorización vigente', async () => {
    const historial = await auth(
      request(http).get(`/elementos-patrimoniales/${depId}/valorizaciones`),
    ).expect(200);
    const primera = historial.body.find(
      (v: { valorAnterior: number }) => v.valorAnterior === 100_000_000,
    );
    const ultima = historial.body.find(
      (v: { valorAnterior: number }) => v.valorAnterior === 120_000_000,
    );

    await auth(
      request(http)
        .post('/comandos/AnularValorizacion')
        .send({ valorizacionId: primera.id, motivo: 'no era esta' }),
    ).expect(409);

    await auth(
      request(http)
        .post('/comandos/AnularValorizacion')
        .send({ valorizacionId: ultima.id, motivo: 'tasación incorrecta' }),
    ).expect(200);
    expect(await valorDep()).toBe(120_000_000); // vuelve al valor anterior a esa valorización
  });

  it('corrige la valorización vigente reemplazando el valor', async () => {
    const historial = await auth(
      request(http).get(`/elementos-patrimoniales/${depId}/valorizaciones`),
    ).expect(200);
    const vigente = historial.body.find(
      (v: { anulada: boolean; correccionDeId: string | null }) =>
        !v.anulada && v.correccionDeId === null,
    );

    const correccion = await auth(
      request(http)
        .post('/comandos/CorregirValorizacion')
        .send({ valorizacionId: vigente.id, valorCorrecto: 118_000_000, motivo: 'la tasación decía 118' }),
    ).expect(201);

    expect(correccion.body.valorAnterior).toBe(120_000_000);
    expect(correccion.body.valorNuevo).toBe(118_000_000);
    expect(correccion.body.correccionDeId).toBe(vigente.id);
    expect(await valorDep()).toBe(118_000_000); // reemplaza, no suma delta al anterior

    const entrada = await prisma.auditoria.findFirst({
      where: { comando: 'CorregirValorizacion' },
    });
    expect(entrada?.entidad_id).toBe(vigente.id);
    expect(entrada?.entidad_relacionada_id).toBe(correccion.body.id);
    expect(entrada?.motivo).toBe('la tasación decía 118');
  });
});
