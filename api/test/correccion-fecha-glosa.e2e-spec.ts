import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * GAPS.md P5 / G9 — CorregirEventoFinanciero acepta nuevaFecha y nuevaGlosa
 * además del monto (todos opcionales, al menos uno). La cadena sigue lineal.
 */
describe('Corrección de fecha y glosa (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token = '';
  let elementoId = '';

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const valorVigente = async () =>
    (await auth(request(http).get(`/elementos-patrimoniales/${elementoId}`)).expect(200)).body
      .valorVigente as number;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'cfg@e2e.cl', nombre: 'C', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'cfg@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201);
    elementoId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Cuenta', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('corrige solo fecha y glosa sin tocar el saldo, y no deja re-corregir', async () => {
    const gasto = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 50_000, moneda: 'CLP', elementoOrigenId: elementoId, fecha: '2026-03-10', glosa: 'compra' })
        .expect(201)
    ).body;
    expect(await valorVigente()).toBe(950_000);

    const corr = (
      await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
        .send({ eventoId: gasto.id, nuevaFecha: '2026-03-01', nuevaGlosa: 'compra supermercado', motivo: 'fecha y glosa erradas' })
        .expect(201)
    ).body;
    expect(corr.correccionDeId).toBe(gasto.id);
    expect(corr.fecha).toBe('2026-03-01');
    expect(corr.glosa).toBe('compra supermercado');
    // el saldo no cambió — no hubo delta de monto
    expect(await valorVigente()).toBe(950_000);

    // el original sigue intacto
    const original = (
      await auth(request(http).get(`/eventos-financieros/${gasto.id}`)).expect(200)
    ).body;
    expect(original.fecha).toBe('2026-03-10');
    expect(original.glosa).toBe('compra');

    // cadena lineal: no se corrige dos veces el mismo evento
    await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
      .send({ eventoId: gasto.id, nuevaGlosa: 'otra', motivo: 'de nuevo' })
      .expect(409);

    const entrada = await prisma.auditoria.findFirst({
      where: { comando: 'CorregirEventoFinanciero', entidad_id: gasto.id },
    });
    expect(entrada?.valor_anterior).toEqual({ fecha: '2026-03-10', glosa: 'compra' });
    expect(entrada?.valor_posterior).toEqual({ fecha: '2026-03-01', glosa: 'compra supermercado' });
  });

  it('corrige monto + fecha juntos: el saldo refleja el delta', async () => {
    const antes = await valorVigente();
    const gasto = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 30_000, moneda: 'CLP', elementoOrigenId: elementoId, fecha: '2026-04-10' })
        .expect(201)
    ).body;
    expect(await valorVigente()).toBe(antes - 30_000);

    const corr = (
      await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
        .send({ eventoId: gasto.id, nuevoMonto: 20_000, nuevaFecha: '2026-04-02', motivo: 'eran 20k el 2' })
        .expect(201)
    ).body;
    expect(corr.fecha).toBe('2026-04-02');
    expect(await valorVigente()).toBe(antes - 20_000);

    // G39 (M12): el detalle del original dice cómo quedó, como la lista.
    const det = await auth(request(http).get(`/eventos-financieros/${gasto.id}`)).expect(200);
    expect(det.body.monto).toBe(30_000);
    expect(det.body.vigente).toEqual({ monto: 20_000, fecha: '2026-04-02', glosa: null, correccionIds: [corr.id] });
    const sinCorr = await auth(request(http).get(`/eventos-financieros/${corr.id}`)).expect(200);
    expect(sinCorr.body.vigente).toBeUndefined();
  });

  it('rechaza una corrección sin cambios', async () => {
    const gasto = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 1_000, moneda: 'CLP', elementoOrigenId: elementoId, fecha: '2026-05-01' })
        .expect(201)
    ).body;
    await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
      .send({ eventoId: gasto.id, nuevoMonto: 1_000, nuevaFecha: '2026-05-01', motivo: 'sin cambios' })
      .expect(400);
  });
});
