import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 9 — Reconstrucción histórica de estado (DDD Sección V).
 * "¿Cuál era el valor en la fecha X?" retrocediendo desde valor_vigente.
 */
describe('Reconstrucción histórica (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let cuentaId: string;
  let inmuebleId: string;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'rec@e2e.cl', nombre: 'Rec', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'rec@e2e.cl', password: 'secret123' })
    ).body.accessToken;

    cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Cuenta', tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 100_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    inmuebleId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Depto', tipo: 'inmueble', categoriaFuncional: 'ACTIVO', valorInicial: 1_000_000, moneda: 'CLP', admiteValorizacion: true })
        .expect(201)
    ).body.id;

    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'INGRESO', monto: 50_000, moneda: 'CLP', elementoDestinoId: cuentaId, fecha: '2026-01-10' })
      .expect(201);
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto: 30_000, moneda: 'CLP', elementoOrigenId: cuentaId, fecha: '2026-03-15' })
      .expect(201);
    await auth(request(http).post('/comandos/RegistrarValorizacion'))
      .send({ elementoId: inmuebleId, valorNuevo: 1_200_000, fecha: '2026-02-20' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const valorEn = async (id: string, fecha: string) =>
    (await auth(request(http).get(`/elementos-patrimoniales/${id}/valor-historico?fecha=${fecha}`)).expect(200))
      .body;

  it('reconstruye el valor de la cuenta en distintos momentos', async () => {
    expect((await valorEn(cuentaId, '2026-01-01')).valor).toBe(100_000); // antes del ingreso
    expect((await valorEn(cuentaId, '2026-02-01')).valor).toBe(150_000); // tras el ingreso
    expect((await valorEn(cuentaId, '2026-04-01')).valor).toBe(120_000); // tras el gasto
  });

  it('para fechas anteriores a toda actividad devuelve el valor inicial', async () => {
    // no hay "fecha de alta" en el modelo (GAPS.md G18)
    expect((await valorEn(cuentaId, '2020-01-01')).valor).toBe(100_000);
  });

  it('trata la valorización como el resto de los hechos con fecha', async () => {
    expect((await valorEn(inmuebleId, '2026-01-01')).valor).toBe(1_000_000);
    expect((await valorEn(inmuebleId, '2026-03-01')).valor).toBe(1_200_000);
  });

  it('reconstruye el patrimonio individual a una fecha', async () => {
    const feb = await auth(
      request(http).get('/usuarios/me/patrimonio-individual/historico?fecha=2026-02-01'),
    ).expect(200);
    const clp = feb.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp.patrimonio).toBe(150_000 + 1_000_000); // cuenta 150k + inmueble aún 1M
  });

  it('calcula la variación patrimonial entre dos fechas', async () => {
    const v = await auth(
      request(http).get('/usuarios/me/variacion-patrimonial?desde=2026-01-01&hasta=2026-04-01'),
    ).expect(200);
    const clp = v.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    // desde: 100k + 1.000k = 1.100k · hasta: 120k + 1.200k = 1.320k
    expect(clp.patrimonioDesde).toBe(1_100_000);
    expect(clp.patrimonioHasta).toBe(1_320_000);
    expect(clp.variacion).toBe(220_000);
  });

  it('exige el parámetro fecha con formato válido', async () => {
    await auth(request(http).get('/usuarios/me/patrimonio-individual/historico')).expect(400);
    await auth(
      request(http).get(`/elementos-patrimoniales/${cuentaId}/valor-historico?fecha=ayer`),
    ).expect(400);
  });

  it('una anulación posterior se refleja en toda la línea de tiempo', async () => {
    const eventoId = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'INGRESO', monto: 999_999, moneda: 'CLP', elementoDestinoId: cuentaId, fecha: '2026-05-01' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/AnularEventoFinanciero'))
      .send({ eventoId, motivo: 'no ocurrió' })
      .expect(200);
    // 2026-06-01 ya no incluye el ingreso anulado
    expect((await valorEn(cuentaId, '2026-06-01')).valor).toBe(120_000);
  });
});
