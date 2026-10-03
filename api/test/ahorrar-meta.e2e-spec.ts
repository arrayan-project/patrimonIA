import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * G33 D-1 — AhorrarParaObjetivo (A1, A2, A6): N orígenes, transferencias a la
 * cuenta de la meta y reserva por el total, en una transacción con auditoría
 * encadenada.
 */
describe('Ahorrar para una meta (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let objetivoId: string;
  let fintual: string;
  let corriente: string;
  let vista: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const valor = async (id: string) =>
    (await auth(request(http).get(`/elementos-patrimoniales/${id}`)).expect(200)).body.valorVigente as number;
  const progreso = async () =>
    (await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.progreso as number;
  const ahorrar = (body: object) => auth(request(http).post('/comandos/AhorrarParaObjetivo')).send(body);

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
      .send({ email: 'ahorro@e2e.cl', nombre: 'A', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'ahorro@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    const el = async (nombre: string, cat: string, valorInicial: number) =>
      (
        await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({ nombre, tipo: 'x', categoriaFuncional: cat, valorInicial, moneda: 'CLP' })
          .expect(201)
      ).body.id as string;
    fintual = await el('Fintual', 'INVERSION', 1_000_000);
    corriente = await el('Corriente', 'LIQUIDEZ', 800_000);
    vista = await el('Vista', 'LIQUIDEZ', 300_000);
    objetivoId = (
      await auth(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Casa', montoObjetivo: 2_000_000 })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sin cuenta de la meta y con varios orígenes, pide elegirla', async () => {
    const r = await ahorrar({
      objetivoId,
      origenes: [
        { elementoId: corriente, monto: 1 },
        { elementoId: vista, monto: 1 },
      ],
    }).expect(400);
    expect(r.body.codigo).toBe('META_SIN_CUENTA');
  });

  it('A1: transfiere a la cuenta de la meta y lo deja ahorrado, con auditoría encadenada', async () => {
    const r = (
      await ahorrar({ objetivoId, destinoId: fintual, origenes: [{ elementoId: corriente, monto: 200_000 }] }).expect(201)
    ).body;
    expect(r).toMatchObject({ destinoId: fintual, total: 200_000, progreso: 200_000 });
    expect(r.transferenciaIds).toHaveLength(1);
    expect(await valor(fintual)).toBe(1_200_000);
    expect(await valor(corriente)).toBe(600_000);

    // La meta no tenía partes: se crea una con su nombre.
    const asg = await prisma.asignacion.findMany({ where: { objetivo_financiero_id: objetivoId } });
    expect(asg.map((a) => a.nombre)).toEqual(['Casa']);

    const raiz = await prisma.auditoria.findFirstOrThrow({ where: { comando: 'AhorrarParaObjetivo' } });
    const hijas = await prisma.auditoria.findMany({ where: { encadenada_de_id: raiz.id } });
    expect(hijas.map((h) => h.comando).sort()).toEqual(['CrearAsignacion', 'CrearReserva', 'RegistrarEventoFinanciero']);
  });

  it('A2: sin destino usa la cuenta de la meta y suma dos orígenes', async () => {
    const r = (
      await ahorrar({
        objetivoId,
        origenes: [
          { elementoId: corriente, monto: 100_000 },
          { elementoId: vista, monto: 300_000 },
        ],
      }).expect(201)
    ).body;
    expect(r).toMatchObject({ destinoId: fintual, total: 400_000, progreso: 600_000 });
    expect(r.transferenciaIds).toHaveLength(2);
    expect(await valor(fintual)).toBe(1_600_000);
    expect(await valor(vista)).toBe(0);
  });

  it('A6: si el origen es la cuenta de la meta, solo ahorra (no transfiere)', async () => {
    const r = (await ahorrar({ objetivoId, origenes: [{ elementoId: fintual, monto: 100_000 }] }).expect(201)).body;
    expect(r.transferenciaIds).toHaveLength(0);
    expect(r.progreso).toBe(700_000);
    expect(await valor(fintual)).toBe(1_600_000);
  });

  it('si un origen no tiene suficiente libre, no se hace nada (una sola transacción)', async () => {
    const r = await ahorrar({
      objetivoId,
      origenes: [
        { elementoId: corriente, monto: 100_000 },
        { elementoId: vista, monto: 50_000 },
      ],
    }).expect(409);
    expect(r.body).toMatchObject({ codigo: 'DISPONIBLE_INSUFICIENTE', datos: { disponible: 0, elementoId: vista } });
    expect(await valor(corriente)).toBe(500_000);
    expect(await progreso()).toBe(700_000);
  });

  it('rechaza un origen repetido', async () => {
    const r = await ahorrar({
      objetivoId,
      origenes: [
        { elementoId: corriente, monto: 1 },
        { elementoId: corriente, monto: 1 },
      ],
    }).expect(400);
    expect(r.body.codigo).toBe('ORIGEN_REPETIDO');
  });

  it('informa lo libre para ahorrar de cada cuenta', async () => {
    const d = (await auth(request(http).get('/usuarios/me/disponibilidad')).expect(200)).body as {
      elementoId: string;
      disponible: number;
    }[];
    const de = (id: string) => d.find((x) => x.elementoId === id)?.disponible;
    expect(de(fintual)).toBe(900_000);
    expect(de(corriente)).toBe(500_000);
    expect(de(vista)).toBe(0);
  });
});
