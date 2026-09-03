import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 6 — Presupuesto (Agregado K, AS #49–#52).
 * No modifica patrimonio; su único efecto es la comparación presupuesto-vs-real
 * (proyección desviacion_presupuestaria).
 */
describe('Presupuesto (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let hogarId: string;
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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'presu@e2e.cl', nombre: 'Presu', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'presu@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    hogarId = (
      await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)
    ).body.id;
    cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre: 'Cuenta',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 1_000_000,
          moneda: 'CLP',
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza FAMILIAR sin hogarId e INDIVIDUAL con hogarId', async () => {
    await auth(request(http).post('/comandos/CrearPresupuesto'))
      .send({ tipo: 'FAMILIAR', periodicidad: 'PERIODICO', intervalo: 'MENSUAL' })
      .expect(400);
    await auth(request(http).post('/comandos/CrearPresupuesto'))
      .send({ tipo: 'INDIVIDUAL', periodicidad: 'PERIODICO', intervalo: 'MENSUAL', hogarId })
      .expect(400);
  });

  it('PERIODICO deriva fecha_fin del intervalo y queda sin estado', async () => {
    const p = await auth(request(http).post('/comandos/CrearPresupuesto'))
      .send({
        tipo: 'INDIVIDUAL',
        periodicidad: 'PERIODICO',
        intervalo: 'MENSUAL',
        fechaInicio: '2020-01-01',
        ingresosEsperados: 2_000_000,
        gastosEsperados: 1_500_000,
      })
      .expect(201);
    expect(p.body.fechaInicio).toBe('2020-01-01');
    expect(p.body.fechaFin).toBe('2020-01-31');
    expect(p.body.estado).toBeNull();
    expect(p.body.vigente).toBe(false); // enero 2020 ya pasó → fuera del calendario
  });

  it('PERIODICO no acepta fechaFin explícita', async () => {
    await auth(request(http).post('/comandos/CrearPresupuesto'))
      .send({
        tipo: 'INDIVIDUAL',
        periodicidad: 'PERIODICO',
        intervalo: 'MENSUAL',
        fechaFin: '2026-12-31',
      })
      .expect(400);
  });

  it('ESPECIFICO nace ACTIVO y se puede cerrar (no eliminar por calendario)', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearPresupuesto'))
        .send({
          tipo: 'FAMILIAR',
          periodicidad: 'ESPECIFICO',
          hogarId,
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          gastosEsperados: 5_000_000,
        })
        .expect(201)
    ).body.id;

    const activo = await auth(request(http).get(`/presupuestos/${id}`)).expect(200);
    expect(activo.body.estado).toBe('ACTIVO');
    expect(activo.body.hogarId).toBe(hogarId);

    const cerrado = await auth(request(http).post('/comandos/CerrarPresupuesto'))
      .send({ presupuestoId: id, motivo: 'propósito cumplido' })
      .expect(200);
    expect(cerrado.body.estado).toBe('CERRADO');
    expect(cerrado.body.vigente).toBe(false);

    // cerrar de nuevo → 409
    await auth(request(http).post('/comandos/CerrarPresupuesto'))
      .send({ presupuestoId: id, motivo: 'otra vez' })
      .expect(409);
  });

  it('CerrarPresupuesto rechaza presupuestos PERIODICOs', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearPresupuesto'))
        .send({ tipo: 'INDIVIDUAL', periodicidad: 'PERIODICO', intervalo: 'ANUAL' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CerrarPresupuesto'))
      .send({ presupuestoId: id, motivo: 'no aplica' })
      .expect(400);
  });

  it('desviacion compara lo esperado con los eventos reales del período', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearPresupuesto'))
        .send({
          tipo: 'INDIVIDUAL',
          periodicidad: 'ESPECIFICO',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          ingresosEsperados: 3_000_000,
          gastosEsperados: 1_000_000,
          ahorroEsperado: 2_000_000,
        })
        .expect(201)
    ).body.id;

    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'INGRESO', monto: 2_500_000, moneda: 'CLP', elementoDestinoId: cuentaId, fecha: '2026-03-10' })
      .expect(201);
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto: 400_000, moneda: 'CLP', elementoOrigenId: cuentaId, fecha: '2026-03-15' })
      .expect(201);
    // fuera del período → no cuenta
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto: 999_999, moneda: 'CLP', elementoOrigenId: cuentaId, fecha: '2027-01-05' })
      .expect(201);

    const d = await auth(request(http).get(`/presupuestos/${id}/desviacion`)).expect(200);
    expect(d.body.real.ingresos).toBe(2_500_000);
    expect(d.body.real.gastos).toBe(400_000);
    expect(d.body.real.ahorro).toBe(2_100_000);
    expect(d.body.desviacion.ingresos).toBe(-500_000);
    expect(d.body.desviacion.gastos).toBe(-600_000);
    expect(d.body.desviacion.ahorro).toBe(100_000);
  });

  it('otro usuario no ve ni toca un presupuesto ajeno', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearPresupuesto'))
        .send({ tipo: 'INDIVIDUAL', periodicidad: 'PERIODICO', intervalo: 'MENSUAL' })
        .expect(201)
    ).body.id;

    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'otro@e2e.cl', nombre: 'Otro', password: 'secret123' })
      .expect(201);
    const otroToken = (
      await request(http).post('/auth/login').send({ email: 'otro@e2e.cl', password: 'secret123' })
    ).body.accessToken;

    await request(http)
      .get(`/presupuestos/${id}`)
      .set('Authorization', `Bearer ${otroToken}`)
      .expect(403);
    await request(http)
      .post('/comandos/EliminarPresupuesto')
      .set('Authorization', `Bearer ${otroToken}`)
      .send({ presupuestoId: id, motivo: 'no es mío pero igual' })
      .expect(403);
  });

  it('EliminarPresupuesto borra la fila y deja rastro en auditoría', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearPresupuesto'))
        .send({ tipo: 'INDIVIDUAL', periodicidad: 'PERIODICO', intervalo: 'MENSUAL' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/EliminarPresupuesto'))
      .send({ presupuestoId: id, motivo: 'error de carga' })
      .expect(200);
    await auth(request(http).get(`/presupuestos/${id}`)).expect(404);

    const rows = await prisma.auditoria.count({
      where: { comando: 'EliminarPresupuesto', entidad_id: id },
    });
    expect(rows).toBe(1);
  });
});
