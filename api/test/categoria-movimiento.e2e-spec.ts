import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 15c — Categorías de movimiento (del hogar, planas, opcionales) + glosa
 * en el evento financiero (GAPS.md G22/G23).
 */
describe('Categorías de movimiento y glosa (e2e)', () => {
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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado, notificacion, idempotencia, tipo_cambio, categoria_movimiento RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'cat@e2e.cl', nombre: 'Cat', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'cat@e2e.cl', password: 'secret123' })
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

  it('crear el hogar siembra el set de categorías por defecto', async () => {
    const cats = await auth(
      request(http).get(`/hogares/${hogarId}/categorias-movimiento`),
    ).expect(200);
    expect(cats.body.length).toBeGreaterThanOrEqual(10);
    expect(cats.body.map((c: { nombre: string }) => c.nombre)).toContain('Mercado');
    expect(cats.body.map((c: { nombre: string }) => c.nombre)).toContain('Sueldo');
    // vienen ordenadas
    expect(cats.body[0].orden).toBe(0);
  });

  it('CRUD de categoría + rechazo de nombre duplicado', async () => {
    const c = (
      await auth(request(http).post('/comandos/CrearCategoriaMovimiento'))
        .send({ hogarId, nombre: 'Mascotas', tipoAplicable: 'GASTO', color: '#8844aa' })
        .expect(201)
    ).body;
    expect(c.orden).toBeGreaterThan(0);

    await auth(request(http).post('/comandos/CrearCategoriaMovimiento'))
      .send({ hogarId, nombre: 'Mascotas', tipoAplicable: 'GASTO' })
      .expect(409);

    const upd = await auth(request(http).post('/comandos/ActualizarCategoriaMovimiento'))
      .send({ categoriaId: c.id, nombre: 'Mascotas y veterinario' })
      .expect(200);
    expect(upd.body.nombre).toBe('Mascotas y veterinario');

    await auth(request(http).post('/comandos/ArchivarCategoriaMovimiento'))
      .send({ categoriaId: c.id })
      .expect(200);
    const activas = await auth(
      request(http).get(`/hogares/${hogarId}/categorias-movimiento`),
    ).expect(200);
    expect(activas.body.some((x: { id: string }) => x.id === c.id)).toBe(false);
    const todas = await auth(
      request(http).get(`/hogares/${hogarId}/categorias-movimiento?incluirArchivadas=true`),
    ).expect(200);
    expect(todas.body.some((x: { id: string }) => x.id === c.id)).toBe(true);
  });

  it('registra un gasto con categoría y glosa; valida el tipo aplicable', async () => {
    const cats = (await auth(request(http).get(`/hogares/${hogarId}/categorias-movimiento`)).expect(200))
      .body;
    const mercado = cats.find((c: { nombre: string }) => c.nombre === 'Mercado');
    const sueldo = cats.find((c: { nombre: string }) => c.nombre === 'Sueldo');

    const ev = await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({
        tipo: 'GASTO',
        monto: 45_000,
        moneda: 'CLP',
        elementoOrigenId: cuentaId,
        categoriaId: mercado.id,
        glosa: 'feria del domingo',
      })
      .expect(201);
    expect(ev.body.categoriaId).toBe(mercado.id);
    expect(ev.body.glosa).toBe('feria del domingo');

    // Sueldo es INGRESO → no aplica a un GASTO
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto: 1, moneda: 'CLP', elementoOrigenId: cuentaId, categoriaId: sueldo.id })
      .expect(400);

    // una transferencia no se categoriza
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'INGRESO', monto: 1, moneda: 'CLP', elementoDestinoId: cuentaId, categoriaId: mercado.id })
      .expect(400);
  });

  it('GET /usuarios/me devuelve preferencias (null por defecto, editable)', async () => {
    const me1 = await auth(request(http).get('/usuarios/me')).expect(200);
    expect(me1.body.preferencias).toBeNull();

    await auth(request(http).post('/comandos/ActualizarDatosUsuario'))
      .send({ preferencias: { formatoFecha: 'largo', tema: 'oscuro' } })
      .expect(200);
    const me2 = await auth(request(http).get('/usuarios/me')).expect(200);
    expect(me2.body.preferencias).toEqual({ formatoFecha: 'largo', tema: 'oscuro' });
  });

  it('un no-miembro no ve ni administra las categorías del hogar', async () => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'ajeno-cat@e2e.cl', nombre: 'Ajeno', password: 'secret123' })
      .expect(201);
    const otro = (
      await request(http)
        .post('/auth/login')
        .send({ email: 'ajeno-cat@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .get(`/hogares/${hogarId}/categorias-movimiento`)
      .set('Authorization', `Bearer ${otro}`)
      .expect(403);
  });
});
