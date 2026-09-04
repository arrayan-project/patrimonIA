import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 8 — Flujo 4 (UX_FLOWS): Deuda / Crédito como especialización de Elemento
 * Patrimonial. CondonarDeuda (#47) y DeclararIncobrable (#48); el resto se
 * reutiliza. Invariante valor_pendiente == |valor_vigente| (GAPS.md G17).
 */
describe('Flujo 4 — Deuda / Crédito (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let cuentaId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const nuevo = (body: Record<string, unknown>) =>
    auth(request(http).post('/comandos/RegistrarElementoPatrimonial')).send(body);

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'deuda@e2e.cl', nombre: 'Deuda', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'deuda@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    cuentaId = (
      await nuevo({
        nombre: 'Cuenta',
        tipo: 'cuenta_corriente',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial: 500_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza valorPendiente en un elemento que no es DEUDA/CREDITO', async () => {
    await nuevo({
      nombre: 'x',
      tipo: 'x',
      categoriaFuncional: 'LIQUIDEZ',
      valorInicial: 0,
      valorPendiente: 100,
      moneda: 'CLP',
    }).expect(400);
  });

  it('rechaza DEUDA sin valorPendiente', async () => {
    await nuevo({ nombre: 'Préstamo', tipo: 'deuda', categoriaFuncional: 'DEUDA', moneda: 'CLP' }).expect(
      400,
    );
  });

  it('crea una DEUDA con valor_vigente negativo y pendiente = magnitud', async () => {
    const d = await nuevo({
      nombre: 'Préstamo auto',
      tipo: 'deuda',
      categoriaFuncional: 'DEUDA',
      valorPendiente: 1_000_000,
      moneda: 'CLP',
      contraparte: 'Banco Estado',
      fechaTermino: '2030-12-01',
      cuotaMonto: 45_000,
      tasaInteres: 12.5,
      observaciones: 'crédito automotriz a 36 meses',
    }).expect(201);
    expect(d.body.valorVigente).toBe(-1_000_000);
    expect(d.body.valorPendiente).toBe(1_000_000);
    expect(d.body.contraparte).toBe('Banco Estado');
    expect(d.body.fechaTermino).toBe('2030-12-01');
    expect(d.body.cuotaMonto).toBe(45_000);
    expect(d.body.tasaInteres).toBe(12.5);
    expect(d.body.estadoOperativo).toBe('VIGENTE');
  });

  it('pagar parte de la deuda (transferencia) reduce el pendiente por el invariante', async () => {
    const deudaId = (
      await nuevo({
        nombre: 'Deuda tarjeta',
        tipo: 'deuda',
        categoriaFuncional: 'DEUDA',
        valorPendiente: 800_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;

    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'TRANSFERENCIA', monto: 300_000, moneda: 'CLP', elementoOrigenId: cuentaId, elementoDestinoId: deudaId })
      .expect(201);

    const deuda = await auth(request(http).get(`/elementos-patrimoniales/${deudaId}`)).expect(200);
    expect(deuda.body.valorVigente).toBe(-500_000);
    expect(deuda.body.valorPendiente).toBe(500_000);
  });

  it('CondonarDeuda lleva pendiente y valor_vigente a cero y registra el impacto', async () => {
    const deudaId = (
      await nuevo({
        nombre: 'Deuda familiar',
        tipo: 'deuda',
        categoriaFuncional: 'DEUDA',
        valorPendiente: 400_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;

    const res = await auth(request(http).post('/comandos/CondonarDeuda'))
      .send({ elementoId: deudaId, motivo: 'la familia perdonó el saldo' })
      .expect(200);
    expect(res.body.valorVigente).toBe(0);
    expect(res.body.valorPendiente).toBe(0);

    expect(
      (await auth(request(http).get(`/elementos-patrimoniales/${deudaId}`)).expect(200)).body
        .estadoOperativo,
    ).toBe('CONDONADA');

    const impactos = await prisma.impacto_patrimonial.findMany({
      where: { elemento_id: deudaId, origen_tipo: 'CONDONACION' },
    });
    expect(impactos).toHaveLength(1);
    expect(Number(impactos[0].monto)).toBe(400_000); // +400k: el patrimonio sube

    // ya no hay saldo → 409
    await auth(request(http).post('/comandos/CondonarDeuda'))
      .send({ elementoId: deudaId, motivo: 'otra vez' })
      .expect(409);
  });

  it('CondonarDeuda rechaza un CREDITO; DeclararIncobrable lo salda', async () => {
    const creditoId = (
      await nuevo({
        nombre: 'Le presté a Juan',
        tipo: 'credito',
        categoriaFuncional: 'CREDITO',
        valorPendiente: 250_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;
    expect(
      (await auth(request(http).get(`/elementos-patrimoniales/${creditoId}`)).expect(200)).body
        .valorVigente,
    ).toBe(250_000);

    await auth(request(http).post('/comandos/CondonarDeuda'))
      .send({ elementoId: creditoId, motivo: 'no aplica' })
      .expect(400);

    const res = await auth(request(http).post('/comandos/DeclararIncobrable'))
      .send({ elementoId: creditoId, motivo: 'Juan no va a pagar' })
      .expect(200);
    expect(res.body.valorVigente).toBe(0);
    expect(res.body.valorPendiente).toBe(0);
  });

  it('filtra por categoría y refleja las deudas en el patrimonio', async () => {
    const deudas = await auth(
      request(http).get('/elementos-patrimoniales?categoria=DEUDA'),
    ).expect(200);
    expect(deudas.body.every((e: { categoriaFuncional: string }) => e.categoriaFuncional === 'DEUDA')).toBe(
      true,
    );

    const patrimonio = await auth(
      request(http).get('/usuarios/me/patrimonio-individual'),
    ).expect(200);
    const clp = patrimonio.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    // Cuenta 200k (500k − 300k transferidos) − Préstamo auto 1.000k − Deuda
    // tarjeta 500k (las condonadas/incobrables ya valen 0) = −1.300k
    expect(clp.patrimonio).toBe(-1_300_000);
  });
});
