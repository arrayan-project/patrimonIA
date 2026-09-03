import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 12 — Idempotency-Key (API_DESIGN §43) y token de pre-registro (GAPS.md G4).
 * Infraestructura de API, no dominio.
 */
describe('Idempotencia y pre-registro (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado, notificacion, idempotencia RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'idem@e2e.cl', nombre: 'Idem', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'idem@e2e.cl', password: 'secret123' })
    ).body.accessToken;
  });

  afterAll(async () => {
    delete process.env.AUTH_REGISTRO_TOKEN_REQUERIDO;
    await app.close();
  });

  it('Idempotency-Key: el segundo request devuelve la misma respuesta sin re-crear', async () => {
    const body = {
      nombre: 'Cuenta',
      tipo: 'cuenta_corriente',
      categoriaFuncional: 'LIQUIDEZ',
      valorInicial: 100_000,
      moneda: 'CLP',
    };
    const primera = await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
      .set('Idempotency-Key', 'abc-123')
      .send(body)
      .expect(201);
    const segunda = await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
      .set('Idempotency-Key', 'abc-123')
      .send(body)
      .expect(201);

    expect(segunda.body.id).toBe(primera.body.id);
    expect(await prisma.elemento_patrimonial.count({ where: { nombre: 'Cuenta' } })).toBe(1);
  });

  it('sin Idempotency-Key el comando se ejecuta siempre', async () => {
    const b = {
      nombre: 'Repetible',
      tipo: 'x',
      categoriaFuncional: 'LIQUIDEZ',
      valorInicial: 0,
      moneda: 'CLP',
    };
    await auth(request(http).post('/comandos/RegistrarElementoPatrimonial')).send(b).expect(201);
    await auth(request(http).post('/comandos/RegistrarElementoPatrimonial')).send(b).expect(201);
    expect(await prisma.elemento_patrimonial.count({ where: { nombre: 'Repetible' } })).toBe(2);
  });

  it('la misma clave con otro usuario no colisiona', async () => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'idem2@e2e.cl', nombre: 'Idem2', password: 'secret123' })
      .expect(201);
    const token2 = (
      await request(http).post('/auth/login').send({ email: 'idem2@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .post('/comandos/RegistrarElementoPatrimonial')
      .set('Authorization', `Bearer ${token2}`)
      .set('Idempotency-Key', 'abc-123')
      .send({ nombre: 'De otro', tipo: 'x', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'CLP' })
      .expect(201);
    expect(await prisma.elemento_patrimonial.count({ where: { nombre: 'De otro' } })).toBe(1);
  });

  it('POST /auth/registro-token emite un token', async () => {
    const r = await request(http).post('/auth/registro-token').expect(200);
    expect(typeof r.body.token).toBe('string');
  });

  describe('con AUTH_REGISTRO_TOKEN_REQUERIDO=true', () => {
    beforeAll(() => {
      process.env.AUTH_REGISTRO_TOKEN_REQUERIDO = 'true';
    });
    afterAll(() => {
      delete process.env.AUTH_REGISTRO_TOKEN_REQUERIDO;
    });

    it('RegistrarUsuario exige el token de registro', async () => {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email: 'sin-token@e2e.cl', nombre: 'X', password: 'secret123' })
        .expect(401);

      const { token: registroToken } = (await request(http).post('/auth/registro-token').expect(200))
        .body;
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .set('X-Registro-Token', registroToken)
        .send({ email: 'con-token@e2e.cl', nombre: 'Y', password: 'secret123' })
        .expect(201);

      // un JWT de usuario normal no sirve como token de registro
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .set('X-Registro-Token', token)
        .send({ email: 'mal-token@e2e.cl', nombre: 'Z', password: 'secret123' })
        .expect(401);
    });
  });
});
