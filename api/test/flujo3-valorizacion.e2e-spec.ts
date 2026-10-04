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
      {
        moneda: 'CLP',
        patrimonio: 130_000_000,
        valorLiquido: 0,
        valorReservado: 0,
        plataAjena: 0,
        valorLibre: 0,
      },
    ]);
  });

  const historial = async () =>
    (await auth(request(http).get(`/elementos-patrimoniales/${depId}/valorizaciones`)).expect(200))
      .body as { id: string; valorAnterior: number; valorNuevo: number; anulada: boolean; correccionDeId: string | null }[];
  const impactosDe = async (valorizacionId: string) =>
    (await prisma.impacto_patrimonial.findMany({ where: { origen_tipo: 'VALORIZACION', origen_id: valorizacionId } }))
      .reduce((s, i) => s + Number(i.monto), 0);

  it('anula una valorización intermedia: la siguiente absorbe la diferencia (G11)', async () => {
    const h = await historial();
    const primera = h.find((v) => v.valorAnterior === 100_000_000)!;
    const segunda = h.find((v) => v.valorAnterior === 120_000_000)!;

    await auth(
      request(http)
        .post('/comandos/AnularValorizacion')
        .send({ valorizacionId: primera.id, motivo: 'no era esta' }),
    ).expect(200);

    // La segunda sigue fijando 130M: el valor vigente no cambia...
    expect(await valorDep()).toBe(130_000_000);
    // ...y su impacto pasa a ser 100M → 130M (inmutable: se agrega un compensatorio).
    expect(await impactosDe(primera.id)).toBe(0);
    expect(await impactosDe(segunda.id)).toBe(30_000_000);
    const entrada = await prisma.auditoria.findFirst({ where: { comando: 'AnularValorizacion' } });
    expect(entrada?.entidad_relacionada_id).toBe(segunda.id);
  });

  it('corrige una valorización intermedia re-encadenando la siguiente (G11)', async () => {
    await auth(
      request(http)
        .post('/comandos/RegistrarValorizacion')
        .send({ elementoId: depId, valorNuevo: 140_000_000 }),
    ).expect(201);
    const h = await historial();
    const segunda = h.find((v) => v.valorAnterior === 120_000_000)!;
    const tercera = h.find((v) => v.valorAnterior === 130_000_000 && v.correccionDeId === null)!;

    const correccion = await auth(
      request(http)
        .post('/comandos/CorregirValorizacion')
        .send({ valorizacionId: segunda.id, valorCorrecto: 125_000_000, motivo: 'la tasación decía 125' }),
    ).expect(201);

    expect(correccion.body.valorAnterior).toBe(130_000_000);
    expect(correccion.body.valorNuevo).toBe(125_000_000);
    expect(correccion.body.correccionDeId).toBe(segunda.id);
    expect(await valorDep()).toBe(140_000_000); // la tercera sigue fijando el valor
    expect(await impactosDe(tercera.id)).toBe(15_000_000); // ahora va de 125M a 140M

    const entrada = await prisma.auditoria.findFirst({
      where: { comando: 'CorregirValorizacion' },
    });
    expect(entrada?.entidad_id).toBe(segunda.id);
    expect(entrada?.entidad_relacionada_id).toBe(correccion.body.id);
    expect(entrada?.motivo).toBe('la tasación decía 125');
  });

  it('anular la última descuenta su delta efectivo', async () => {
    const tercera = (await historial()).find((v) => v.valorAnterior === 130_000_000 && v.correccionDeId === null)!;
    await auth(
      request(http)
        .post('/comandos/AnularValorizacion')
        .send({ valorizacionId: tercera.id, motivo: 'tasación incorrecta' }),
    ).expect(200);
    expect(await valorDep()).toBe(125_000_000); // vuelve al valor corregido de la segunda
  });

  it('no deja anular una valorización con corrección vigente', async () => {
    const segunda = (await historial()).find((v) => v.valorAnterior === 120_000_000)!;
    await auth(
      request(http)
        .post('/comandos/AnularValorizacion')
        .send({ valorizacionId: segunda.id, motivo: 'no va' }),
    ).expect(409);
  });
});
