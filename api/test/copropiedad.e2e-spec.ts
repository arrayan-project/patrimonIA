import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * B8 — alta de elemento con co-propietarios y porcentajes. El contrato
 * (`propietarios[]`) existe desde Fase 2; esta suite lo fija para la UI.
 */
describe('Co-propiedad al registrar un elemento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let anaId: string;
  let betoId: string;

  const login = async (email: string): Promise<string> =>
    (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body
      .accessToken;
  const bearer = (r: request.Test, t: string) => r.set('Authorization', `Bearer ${t}`);

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
    for (const [email, nombre] of [
      ['ana@cop.cl', 'Ana'],
      ['beto@cop.cl', 'Beto'],
    ]) {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre, password: 'secret123' })
        .expect(201);
    }
    anaId = (await prisma.usuario.findUniqueOrThrow({ where: { email: 'ana@cop.cl' } })).id;
    betoId = (await prisma.usuario.findUniqueOrThrow({ where: { email: 'beto@cop.cl' } })).id;

    // P12 — co-propiedad estricta: Ana y Beto comparten un hogar.
    const tAna = await login('ana@cop.cl');
    const hogarId = (
      await bearer(request(http).post('/comandos/CrearHogar'), tAna).send({ nombre: 'Casa' }).expect(201)
    ).body.id;
    const inv = (
      await bearer(request(http).post('/comandos/InvitarMiembro'), tAna)
        .send({ hogarId, emailInvitado: 'beto@cop.cl' })
        .expect(201)
    ).body;
    const tBeto = await login('beto@cop.cl');
    await bearer(request(http).post('/comandos/AceptarInvitacion'), tBeto)
      .send({ invitacionId: inv.id })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const alta = (t: string, body: Record<string, unknown>) =>
    bearer(request(http).post('/comandos/RegistrarElementoPatrimonial'), t).send({
      nombre: 'Depto',
      tipo: 'inmueble',
      categoriaFuncional: 'ACTIVO',
      valorInicial: 100_000_000,
      moneda: 'CLP',
      ...body,
    });

  it('registra un elemento 60/40 y ambos lo ven con su porcentaje', async () => {
    const t = await login('ana@cop.cl');
    const el = (
      await alta(t, {
        propietarios: [
          { usuarioId: anaId, porcentaje: 60 },
          { usuarioId: betoId, porcentaje: 40 },
        ],
      }).expect(201)
    ).body;

    const detalle = (
      await bearer(request(http).get(`/elementos-patrimoniales/${el.id}`), t).expect(200)
    ).body;
    const pct = Object.fromEntries(
      detalle.propietarios.map((p: { usuarioId: string; porcentaje: number }) => [
        p.usuarioId,
        Number(p.porcentaje),
      ]),
    );
    expect(pct[anaId]).toBe(60);
    expect(pct[betoId]).toBe(40);

    const tBeto = await login('beto@cop.cl');
    const listaBeto = (
      await bearer(request(http).get('/elementos-patrimoniales?propietario=me'), tBeto).expect(200)
    ).body;
    expect(listaBeto.map((e: { id: string }) => e.id)).toContain(el.id);
  });

  it('rechaza si los porcentajes no suman 100', async () => {
    const t = await login('ana@cop.cl');
    await alta(t, {
      propietarios: [
        { usuarioId: anaId, porcentaje: 70 },
        { usuarioId: betoId, porcentaje: 40 },
      ],
    }).expect(400);
  });

  it('rechaza si el actor no figura entre los propietarios', async () => {
    const t = await login('ana@cop.cl');
    await alta(t, { propietarios: [{ usuarioId: betoId, porcentaje: 100 }] }).expect(400);
  });

  it('P12 — rechaza un co-propietario que no comparte hogar con el actor', async () => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'carla@cop.cl', nombre: 'Carla', password: 'secret123' })
      .expect(201);
    const carlaId = (await prisma.usuario.findUniqueOrThrow({ where: { email: 'carla@cop.cl' } })).id;
    const t = await login('ana@cop.cl');
    await alta(t, {
      propietarios: [
        { usuarioId: anaId, porcentaje: 50 },
        { usuarioId: carlaId, porcentaje: 50 },
      ],
    }).expect(400);
  });
});
