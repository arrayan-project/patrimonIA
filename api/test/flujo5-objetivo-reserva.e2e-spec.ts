import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 5c — Flujo 5 (UX_FLOWS): objetivo → asignación → reserva → completar.
 * Política automática "Completar objetivo" (Principio 4) y "Consumir reserva".
 */
describe('Flujo 5 — objetivo + asignación + reserva (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let objetivoId: string;
  let asignacionId: string;
  let fintualId: string;
  let ahorroId: string;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'p@e2e.cl', nombre: 'P', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'p@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    const el = (nombre: string, cat: string, valor: number) =>
      auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre, tipo: 'x', categoriaFuncional: cat, valorInicial: valor, moneda: 'CLP' })
        .expect(201);
    fintualId = (await el('Fintual', 'INVERSION', 3_000_000)).body.id;
    ahorroId = (await el('Ahorro', 'LIQUIDEZ', 15_000_000)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea objetivo y asignación', async () => {
    objetivoId = (
      await auth(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Pie vivienda', montoObjetivo: 10_000_000 })
        .expect(201)
    ).body.id;
    asignacionId = (
      await auth(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Casa', objetivoId })
        .expect(201)
    ).body.id;
  });

  it('reservar respeta la disponibilidad del elemento origen', async () => {
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: fintualId, monto: 2_000_000 })
      .expect(201);
    // Fintual = 3M, ya reservado 2M → solo 1M disponible
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: fintualId, monto: 2_000_000 })
      .expect(409);

    const obj = await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200);
    expect(obj.body.progreso).toBe(2_000_000);
    expect(obj.body.progresoPorcentaje).toBe(20);
    expect(obj.body.estado).toBe('EN_PROGRESO');
  });

  it('al alcanzar el monto objetivo se completa solo (política encadenada)', async () => {
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: ahorroId, monto: 8_000_000 })
      .expect(201);

    const obj = await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200);
    expect(obj.body.progreso).toBe(10_000_000);
    expect(obj.body.estado).toBe('COMPLETADO');

    const completar = await prisma.auditoria.findFirst({ where: { comando: 'CompletarObjetivo' } });
    const raizId = completar?.encadenada_de_id;
    expect(raizId).toBeTruthy();
    const raiz = await prisma.auditoria.findUnique({ where: { id: raizId as string } });
    expect(raiz?.comando).toBe('CrearReserva');
  });

  it('un evento asociado a la asignación consume sus reservas solo hasta su monto (G14)', async () => {
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({
        tipo: 'GASTO',
        monto: 100_000,
        moneda: 'CLP',
        elementoOrigenId: ahorroId,
        asignacionId,
      })
      .expect(201);

    // Primero la reserva del elemento que mueve el evento (ahorro, 8M): se
    // divide en 100k CONSUMIDA + 7,9M ACTIVA. La de Fintual (2M) no se toca.
    const reservas = await prisma.reserva.findMany({ where: { asignacion_id: asignacionId } });
    const resumen = reservas
      .map((r) => `${r.elemento_origen_id === ahorroId ? 'ahorro' : 'fintual'}:${r.estado}:${Number(r.monto)}`)
      .sort();
    expect(resumen).toEqual(['ahorro:ACTIVA:7900000', 'ahorro:CONSUMIDA:100000', 'fintual:ACTIVA:2000000']);

    const entrada = await prisma.auditoria.findFirst({
      where: { comando: 'RegistrarEventoFinanciero' },
      orderBy: { fecha_hora: 'desc' },
    });
    const vp = (entrada?.valor_posterior ?? {}) as { reservas_consumidas?: { monto: number; resto_id?: string }[] };
    expect(vp.reservas_consumidas).toHaveLength(1);
    expect(vp.reservas_consumidas?.[0]).toMatchObject({ monto: 100_000, resto_id: expect.any(String) });

    const obj = await auth(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200);
    expect(obj.body.progreso).toBe(9_900_000);
  });

  it('un evento mayor que lo reservado en su cuenta no toca las reservas de otras cuentas (HZ-13)', async () => {
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto: 8_500_000, moneda: 'CLP', elementoOrigenId: ahorroId, asignacionId })
      .expect(201);
    const activas = await prisma.reserva.findMany({ where: { asignacion_id: asignacionId, estado: 'ACTIVA' } });
    // Se consumen los 7,9M de ahorro; los 600k restantes salen de lo libre de
    // ahorro. Los 2M de Fintual siguen intactos.
    expect(activas.map((r) => [r.elemento_origen_id, Number(r.monto)])).toEqual([[fintualId, 2_000_000]]);
  });

  it('liberar una reserva baja el progreso (pero no revierte el estado)', async () => {
    // Nuevo objetivo desde cero para probar liberar
    const obj = (
      await auth(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Auto', montoObjetivo: 5_000_000 })
        .expect(201)
    ).body.id;
    const asg = (
      await auth(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Auto', objetivoId: obj })
        .expect(201)
    ).body.id;
    const reserva = (
      await auth(request(http).post('/comandos/CrearReserva'))
        .send({ asignacionId: asg, elementoOrigenId: ahorroId, monto: 1_000_000 })
        .expect(201)
    ).body.id;

    await auth(request(http).post('/comandos/LiberarReserva'))
      .send({ reservaId: reserva, motivo: 'necesito la plata' })
      .expect(200);

    const objDto = await auth(request(http).get(`/objetivos-financieros/${obj}`)).expect(200);
    expect(objDto.body.progreso).toBe(0);
    expect(objDto.body.estado).toBe('EN_PROGRESO');
  });
});
