import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 7 — Movimiento Programado (agregado propio, AS #13–#16).
 * Planificación: no toca patrimonio hasta materializarse, y entonces dispara un
 * Evento Financiero INGRESO hacia el elemento destino (GAPS.md G2).
 */
describe('Movimiento Programado (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let cuentaId: string;

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
      .send({ email: 'mp@e2e.cl', nombre: 'MP', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'mp@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre: 'Cuenta',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 500_000,
          moneda: 'CLP',
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea un movimiento PENDIENTE sin tocar el patrimonio', async () => {
    const m = await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({
        montoPlanificado: 300_000,
        moneda: 'CLP',
        fechaProgramada: '2020-01-15',
        elementoDestinoId: cuentaId,
        observaciones: 'sueldo',
      })
      .expect(201);
    expect(m.body.estado).toBe('PENDIENTE');
    expect(m.body.eventoFinancieroId).toBeNull();

    const el = await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200);
    expect(el.body.valorVigente).toBe(500_000); // sin cambios
  });

  it('rechaza moneda que no calza con el elemento destino', async () => {
    await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({ montoPlanificado: 100, moneda: 'USD', fechaProgramada: '2020-02-01', elementoDestinoId: cuentaId })
      .expect(400);
  });

  it('actualiza solo mientras esté PENDIENTE', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ montoPlanificado: 100_000, moneda: 'CLP', fechaProgramada: '2020-03-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    const upd = await auth(request(http).post('/comandos/ActualizarMovimientoProgramado'))
      .send({ movimientoId: id, montoPlanificado: 120_000 })
      .expect(200);
    expect(upd.body.montoPlanificado).toBe(120_000);
  });

  it('no materializa antes de la fecha programada', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ montoPlanificado: 50_000, moneda: 'CLP', fechaProgramada: '2999-01-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(400);
  });

  it('materializa: genera un INGRESO, mueve el valor_vigente y encadena la auditoría', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ montoPlanificado: 300_000, moneda: 'CLP', fechaProgramada: '2020-06-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;

    const mat = await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id, montoEfectivo: 320_000, fechaEfectiva: '2020-06-03' })
      .expect(200);
    expect(mat.body.estado).toBe('MATERIALIZADO');
    expect(mat.body.eventoFinancieroId).toBeTruthy();

    const el = await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200);
    expect(el.body.valorVigente).toBe(820_000); // 500.000 + 320.000

    const evento = await auth(
      request(http).get(`/eventos-financieros/${mat.body.eventoFinancieroId}`),
    ).expect(200);
    expect(evento.body.tipo).toBe('INGRESO');
    expect(evento.body.monto).toBe(320_000);

    // una sola entrada de auditoría, bajo el comando de materializar
    const rows = await prisma.auditoria.count({
      where: { comando: 'MaterializarMovimientoProgramado', entidad_id: id },
    });
    expect(rows).toBe(1);
    const registrarEvento = await prisma.auditoria.count({
      where: { comando: 'RegistrarEventoFinanciero', entidad_id: mat.body.eventoFinancieroId },
    });
    expect(registrarEvento).toBe(0);

    // ya materializado → no se puede actualizar ni cancelar
    await auth(request(http).post('/comandos/ActualizarMovimientoProgramado'))
      .send({ movimientoId: id, montoPlanificado: 1 })
      .expect(409);
    await auth(request(http).post('/comandos/CancelarMovimientoProgramado'))
      .send({ movimientoId: id, motivo: 'tarde' })
      .expect(409);
  });

  it('cancela un movimiento pendiente y bloquea acciones posteriores', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ montoPlanificado: 10_000, moneda: 'CLP', fechaProgramada: '2020-07-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CancelarMovimientoProgramado'))
      .send({ movimientoId: id, motivo: 'ya no aplica' })
      .expect(200);
    await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(409);
  });

  it('otro usuario no ve ni toca un movimiento de un elemento ajeno', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ montoPlanificado: 1_000, moneda: 'CLP', fechaProgramada: '2020-08-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'ajeno@e2e.cl', nombre: 'Ajeno', password: 'secret123' })
      .expect(201);
    const otro = (
      await request(http).post('/auth/login').send({ email: 'ajeno@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .get(`/movimientos-programados/${id}`)
      .set('Authorization', `Bearer ${otro}`)
      .expect(403);
  });

  it('lista los movimientos pendientes del usuario', async () => {
    const pendientes = await auth(
      request(http).get('/movimientos-programados?estado=PENDIENTE'),
    ).expect(200);
    expect(Array.isArray(pendientes.body)).toBe(true);
    expect(pendientes.body.every((m: { estado: string }) => m.estado === 'PENDIENTE')).toBe(true);
  });
});
