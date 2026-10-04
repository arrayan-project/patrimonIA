import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * A1/A2 — disponibilidad financiera (líquido / reservado / libre) y trazabilidad
 * elemento → reserva. A5 — historial de auditoría por entidad.
 */
describe('Disponibilidad + historial (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let cuentaId: string;
  let objetivoId: string;
  let asignacionId: string;

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
      .send({ email: 'd@e2e.cl', nombre: 'D', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'd@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre: 'Cuenta corriente',
          tipo: 'cuenta',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 1_000_000,
          moneda: 'CLP',
          participaValorLiquido: true,
        })
        .expect(201)
    ).body.id;
    objetivoId = (
      await auth(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Vacaciones', montoObjetivo: 2_000_000 })
        .expect(201)
    ).body.id;
    asignacionId = (
      await auth(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Pasajes', objetivoId })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('patrimonio-individual expone reservado y libre', async () => {
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: cuentaId, monto: 300_000 })
      .expect(201);

    const p = await auth(request(http).get('/usuarios/me/patrimonio-individual')).expect(200);
    const clp = p.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp.valorLiquido).toBe(1_000_000);
    expect(clp.valorReservado).toBe(300_000);
    expect(clp.reservadoEnLiquidez).toBe(300_000);
    expect(clp.valorLibre).toBe(700_000);
  });

  it('lo ahorrado en una cuenta que no es líquida no se resta de lo libre', async () => {
    const ahorro = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Cuenta de ahorro', tipo: 'cuenta', categoriaFuncional: 'RESERVA', valorInicial: 2_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: ahorro, monto: 1_200_000 })
      .expect(201);

    const p = await auth(request(http).get('/usuarios/me/patrimonio-individual')).expect(200);
    const clp = p.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp.valorLiquido).toBe(1_000_000);
    expect(clp.valorReservado).toBe(1_500_000);
    expect(clp.reservadoEnLiquidez).toBe(300_000);
    expect(clp.valorLibre).toBe(700_000);
  });

  it('el elemento muestra qué reservas lo comprometen', async () => {
    const r = await auth(
      request(http).get(`/elementos-patrimoniales/${cuentaId}/reservas`),
    ).expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({
      monto: 300_000,
      asignacionNombre: 'Pasajes',
      objetivoId,
      objetivoNombre: 'Vacaciones',
    });
  });

  it('historial del elemento lista los comandos ejecutados sobre él', async () => {
    await auth(request(http).post('/comandos/ActualizarDatosElementoPatrimonial'))
      .send({ elementoId: cuentaId, nombre: 'Cuenta corriente Banco X' })
      .expect(200);

    const h = await auth(
      request(http).get(`/historial?entidadTipo=ELEMENTO_PATRIMONIAL&entidadId=${cuentaId}`),
    ).expect(200);
    const comandos = h.body.map((e: { comando: string }) => e.comando);
    expect(comandos).toContain('RegistrarElementoPatrimonial');
    expect(comandos).toContain('ActualizarDatosElementoPatrimonial');
    expect(h.body[0].usuarioNombre).toBe('D');
    // orden descendente por fecha
    expect(h.body[0].comando).toBe('ActualizarDatosElementoPatrimonial');
  });

  it('historial rechaza tipo no soportado y entidad ajena', async () => {
    await auth(request(http).get(`/historial?entidadTipo=RESERVA&entidadId=${cuentaId}`)).expect(400);

    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'otro@e2e.cl', nombre: 'Otro', password: 'secret123' })
      .expect(201);
    const otroToken = (
      await request(http).post('/auth/login').send({ email: 'otro@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .get(`/historial?entidadTipo=ELEMENTO_PATRIMONIAL&entidadId=${cuentaId}`)
      .set('Authorization', `Bearer ${otroToken}`)
      .expect(403);
  });
});
