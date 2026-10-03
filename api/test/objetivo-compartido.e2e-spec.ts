import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * GAPS.md P9 / B6 — objetivos compartidos por hogar: todos los miembros ven,
 * solo los designados (y el dueño) modifican; el ADMIN asigna designados.
 */
describe('Objetivo compartido por hogar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let admin = '';
  let miembro = '';
  let miembroId = '';
  let hogarId = '';
  let objetivoId = '';
  let cuentaMiembro = '';

  const A = (r: request.Test) => r.set('Authorization', `Bearer ${admin}`);
  const M = (r: request.Test) => r.set('Authorization', `Bearer ${miembro}`);

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, objetivo_financiero, objetivo_designado, asignacion, reserva RESTART IDENTITY CASCADE',
    );
    const reg = async (email: string) => {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre: email[0], password: 'secret123' })
        .expect(201);
      return (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body
        .accessToken as string;
    };
    admin = await reg('admin-oc@e2e.cl');
    miembro = await reg('miembro-oc@e2e.cl');
    miembroId = (await M(request(http).get('/usuarios/me')).expect(200)).body.id;

    hogarId = (await A(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201))
      .body.id;
    const inv = (
      await A(request(http).post('/comandos/InvitarMiembro'))
        .send({ hogarId, emailInvitado: 'miembro-oc@e2e.cl' })
        .expect(201)
    ).body;
    await M(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv.id }).expect(200);

    cuentaMiembro = (
      await M(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Cuenta', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 5_000_000, moneda: 'CLP' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('el admin crea un objetivo compartido; el miembro lo ve pero no lo modifica', async () => {
    objetivoId = (
      await A(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Vacaciones familia', montoObjetivo: 3_000_000, hogarId })
        .expect(201)
    ).body.id;

    const visto = (await M(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body;
    expect(visto.hogarId).toBe(hogarId);
    expect(visto.esMio).toBe(false);
    expect(visto.puedoModificar).toBe(false);

    // aparece en la lista del miembro
    const lista = (await M(request(http).get('/objetivos-financieros')).expect(200)).body;
    expect(lista.some((o: { id: string }) => o.id === objetivoId)).toBe(true);

    // el miembro no puede editar ni crear asignaciones todavía
    await M(request(http).post('/comandos/ActualizarDatosObjetivoFinanciero'))
      .send({ objetivoId, nombre: 'otro' })
      .expect(403);
    await M(request(http).post('/comandos/CrearAsignacion'))
      .send({ nombre: 'Aporte', objetivoId })
      .expect(404);
  });

  it('el admin designa al miembro y este puede aportar su propio dinero', async () => {
    const upd = (
      await A(request(http).post('/comandos/DefinirDesignadosObjetivo'))
        .send({ objetivoId, usuarioIds: [miembroId] })
        .expect(200)
    ).body;
    expect(upd.designados).toEqual([miembroId]);

    const asignacionId = (
      await M(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Aporte de M', objetivoId })
        .expect(201)
    ).body.id;
    await M(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: cuentaMiembro, monto: 1_000_000 })
      .expect(201);

    // el progreso lo ven ambos
    const desdeAdmin = (await A(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body;
    expect(desdeAdmin.progreso).toBe(1_000_000);
    expect((await M(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.puedoModificar).toBe(true);
  });

  it('el designado puede gastar desde la parte que creó el dueño (G33)', async () => {
    const asignacionId = (
      await A(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Parte del admin', objetivoId })
        .expect(201)
    ).body.id;
    await M(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId, elementoOrigenId: cuentaMiembro, monto: 200_000 })
      .expect(201);
    const antes = (await A(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.progreso;

    await M(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto: 50_000, moneda: 'CLP', elementoOrigenId: cuentaMiembro, asignacionId })
      .expect(201);

    const despues = (await A(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(200)).body.progreso;
    expect(antes - despues).toBe(50_000);
  });

  it('solo el admin (o el dueño) asigna designados', async () => {
    await M(request(http).post('/comandos/DefinirDesignadosObjetivo'))
      .send({ objetivoId, usuarioIds: [] })
      .expect(403);
  });

  it('dejar de compartir limpia los designados', async () => {
    const upd = (
      await A(request(http).post('/comandos/CompartirObjetivoConHogar'))
        .send({ objetivoId, hogarId: null })
        .expect(200)
    ).body;
    expect(upd.hogarId).toBeNull();
    expect(upd.designados).toEqual([]);
    await M(request(http).get(`/objetivos-financieros/${objetivoId}`)).expect(404);
  });
});
