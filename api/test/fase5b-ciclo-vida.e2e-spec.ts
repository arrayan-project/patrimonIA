import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/** Fase 5b — comandos de ciclo de vida y edición (Elemento, Hogar, Usuario). */
describe('Fase 5b — ciclo de vida (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;

  const login = async (email: string): Promise<string> =>
    (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body
      .accessToken;
  const bearer = (r: request.Test, t: string) => r.set('Authorization', `Bearer ${t}`);

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial RESTART IDENTITY CASCADE',
    );
    for (const [email, nombre] of [
      ['ana@5b.cl', 'Ana'],
      ['beto@5b.cl', 'Beto'],
    ]) {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre, password: 'secret123' })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('elemento: desactivar → oculto de la lista → reactivar', async () => {
    const t = await login('ana@5b.cl');
    const el = (
      await bearer(
        request(http).post('/comandos/RegistrarElementoPatrimonial'),
        t,
      ).send({
        nombre: 'Auto',
        tipo: 'vehiculo',
        categoriaFuncional: 'ACTIVO',
        valorInicial: 5_000_000,
        moneda: 'CLP',
      })
    ).body.id;

    await bearer(request(http).post('/comandos/ActualizarDatosElementoPatrimonial'), t)
      .send({ elementoId: el, nombre: 'Auto familiar' })
      .expect(200);

    await bearer(request(http).post('/comandos/DesactivarElementoPatrimonial'), t)
      .send({ elementoId: el, motivo: 'lo vendí' })
      .expect(200);
    expect((await bearer(request(http).get('/elementos-patrimoniales?propietario=me'), t)).body).toHaveLength(0);
    expect(
      (await bearer(request(http).get('/elementos-patrimoniales?propietario=me&incluirInactivos=true'), t)).body,
    ).toHaveLength(1);

    await bearer(request(http).post('/comandos/ReactivarElementoPatrimonial'), t)
      .send({ elementoId: el, motivo: 'la venta se cayó' })
      .expect(200);
    const reactivado = (
      await bearer(request(http).get(`/elementos-patrimoniales/${el}`), t)
    ).body;
    expect(reactivado.estado).toBe('ACTIVO');
    expect(reactivado.nombre).toBe('Auto familiar');
  });

  it('hogar: solo admin edita; no se puede quedar sin administrador', async () => {
    const ana = await login('ana@5b.cl');
    const beto = await login('beto@5b.cl');
    const betoId = (await bearer(request(http).get('/usuarios/me'), beto)).body.id;
    const anaId = (await bearer(request(http).get('/usuarios/me'), ana)).body.id;

    const hogar = (
      await bearer(request(http).post('/comandos/CrearHogar'), ana).send({ nombre: 'Casa' })
    ).body.id;
    const inv = (
      await bearer(request(http).post('/comandos/InvitarMiembro'), ana).send({
        hogarId: hogar,
        emailInvitado: 'beto@5b.cl',
      })
    ).body.id;
    await bearer(request(http).post('/comandos/AceptarInvitacion'), beto)
      .send({ invitacionId: inv })
      .expect(200);

    await bearer(request(http).post('/comandos/ActualizarDatosHogar'), beto)
      .send({ hogarId: hogar, nombre: 'X' })
      .expect(403);
    await bearer(request(http).post('/comandos/ActualizarDatosHogar'), ana)
      .send({ hogarId: hogar, nombre: 'Casa Pérez' })
      .expect(200);

    // Ana no puede degradarse siendo la única administradora
    await bearer(request(http).post('/comandos/AsignarRol'), ana)
      .send({ hogarId: hogar, usuarioId: anaId, rol: 'MIEMBRO' })
      .expect(409);

    await bearer(request(http).post('/comandos/AsignarRol'), ana)
      .send({ hogarId: hogar, usuarioId: betoId, rol: 'ADMINISTRADOR' })
      .expect(200);
    await bearer(request(http).post('/comandos/RemoverMiembro'), beto)
      .send({ hogarId: hogar, usuarioId: anaId, motivo: 'se fue' })
      .expect(200);

    await bearer(request(http).post('/comandos/EliminarHogar'), beto)
      .send({ hogarId: hogar, motivo: 'fin' })
      .expect(200);
    await bearer(request(http).get(`/hogares/${hogar}`), beto).expect(403);
  });

  it('usuario: actualizar datos y desactivar cuenta', async () => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'caro@5b.cl', nombre: 'Caro', password: 'secret123' })
      .expect(201);
    const t = await login('caro@5b.cl');

    const actualizado = await bearer(request(http).post('/comandos/ActualizarDatosUsuario'), t)
      .send({ nombre: 'Carolina' })
      .expect(200);
    expect(actualizado.body.nombre).toBe('Carolina');

    await bearer(request(http).post('/comandos/DesactivarUsuario'), t)
      .send({ motivo: 'ya no la uso' })
      .expect(200);
    await request(http)
      .post('/auth/login')
      .send({ email: 'caro@5b.cl', password: 'secret123' })
      .expect(401);
  });
});
