import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 2 — Flujo 1 (día a día financiero), sobre el "caso de uso típico" de
 * REQUISITES: sueldo, transferencia entre cuentas propias, gasto. Contra el
 * backend real, con rastro en `auditoria`.
 */
describe('Flujo 1 — día a día financiero (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let ccId: string;
  let rutId: string;

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
      .send({ email: 'juan@e2e.cl', nombre: 'Juan', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'juan@e2e.cl', password: 'secret123' })
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  const registrarElemento = (nombre: string) =>
    auth(
      request(http).post('/comandos/RegistrarElementoPatrimonial').send({
        nombre,
        tipo: 'cuenta_corriente',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial: 0,
        moneda: 'CLP',
        participaValorLiquido: true,
      }),
    ).expect(201);

  const evento = (body: Record<string, unknown>) =>
    auth(request(http).post('/comandos/RegistrarEventoFinanciero').send(body)).expect(201);

  it('registra dos cuentas', async () => {
    ccId = (await registrarElemento('Cuenta Corriente')).body.id;
    rutId = (await registrarElemento('Cuenta RUT')).body.id;
    expect(ccId).toBeDefined();
    expect(rutId).toBeDefined();
  });

  it('sueldo → transferencia → gasto ajustan los saldos y el patrimonio', async () => {
    await evento({ tipo: 'INGRESO', monto: 1_000_000, moneda: 'CLP', elementoDestinoId: ccId });
    await evento({
      tipo: 'TRANSFERENCIA',
      monto: 300_000,
      moneda: 'CLP',
      elementoOrigenId: ccId,
      elementoDestinoId: rutId,
    });
    await evento({ tipo: 'GASTO', monto: 50_000, moneda: 'CLP', elementoOrigenId: rutId });

    const cc = await auth(request(http).get(`/elementos-patrimoniales/${ccId}`)).expect(200);
    const rut = await auth(request(http).get(`/elementos-patrimoniales/${rutId}`)).expect(200);
    expect(cc.body.valorVigente).toBe(700_000);
    expect(rut.body.valorVigente).toBe(250_000);

    const patrimonio = await auth(
      request(http).get('/usuarios/me/patrimonio-individual'),
    ).expect(200);
    expect(patrimonio.body.porMoneda).toEqual([
      {
        moneda: 'CLP',
        patrimonio: 950_000,
        valorLiquido: 950_000,
        valorReservado: 0,
        reservadoEnLiquidez: 0,
        plataAjena: 0,
        valorLibre: 950_000,
      },
    ]);
  });

  it('el historial del elemento muestra sus impactos y eventos', async () => {
    const impactos = await auth(
      request(http).get(`/elementos-patrimoniales/${ccId}/impactos`),
    ).expect(200);
    // sueldo (+1M) y salida de la transferencia (−300k)
    expect(impactos.body.map((i: { monto: number }) => i.monto).sort((a: number, b: number) => a - b)).toEqual([
      -300_000, 1_000_000,
    ]);

    const eventos = await auth(
      request(http).get(`/eventos-financieros?elemento=${rutId}`),
    ).expect(200);
    expect(eventos.body.map((e: { tipo: string }) => e.tipo).sort()).toEqual(['GASTO', 'TRANSFERENCIA']);
  });

  it('auditoría: una entrada por comando, en la misma transacción', async () => {
    const entradas = await prisma.auditoria.findMany({ orderBy: { fecha_hora: 'asc' } });
    expect(entradas.map((e) => e.comando)).toEqual([
      'RegistrarUsuario',
      'RegistrarElementoPatrimonial',
      'RegistrarElementoPatrimonial',
      'RegistrarEventoFinanciero',
      'RegistrarEventoFinanciero',
      'RegistrarEventoFinanciero',
    ]);
    const transfer = entradas.find(
      (e) =>
        e.comando === 'RegistrarEventoFinanciero' &&
        (e.valor_posterior as { tipo?: string })?.tipo === 'TRANSFERENCIA',
    )!;
    expect(transfer.entidad_tipo).toBe('EVENTO_FINANCIERO');
    expect((transfer.valor_posterior as { impactos: unknown[] }).impactos).toHaveLength(2);
  });

  it('rechaza un evento sobre un elemento ajeno', async () => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'otro@e2e.cl', nombre: 'Otro', password: 'secret123' })
      .expect(201);
    const otroTok = (
      await request(http).post('/auth/login').send({ email: 'otro@e2e.cl', password: 'secret123' })
    ).body.accessToken;

    await request(http)
      .post('/comandos/RegistrarEventoFinanciero')
      .set('Authorization', `Bearer ${otroTok}`)
      .send({ tipo: 'GASTO', monto: 1000, moneda: 'CLP', elementoOrigenId: ccId })
      .expect(403);
  });
});
