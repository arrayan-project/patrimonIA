import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { EMAIL_SENDER, type EmailSender } from './../src/auth/email-sender.js';

const emailsEnviados: { a: string; asunto: string; cuerpo: string }[] = [];
const emailSpy: EmailSender = {
  async enviar(a, asunto, cuerpo) {
    emailsEnviados.push({ a, asunto, cuerpo });
  },
};
/** Extrae el código de 6 dígitos del cuerpo del último email a `destinatario`. */
const codigoDelEmail = (destinatario: string) => {
  const email = [...emailsEnviados].reverse().find((e) => e.a === destinatario);
  return email?.cuerpo.match(/\b\d{6}\b/)?.[0];
};

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
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_SENDER)
      .useValue(emailSpy)
      .compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado, notificacion, idempotencia, codigo_verificacion RESTART IDENTITY CASCADE',
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

  it('POST /auth/registro-token emite un token (y lo liga al email si se da)', async () => {
    const r = await request(http).post('/auth/registro-token').send({}).expect(200);
    expect(typeof r.body.token).toBe('string');
    const conEmail = await request(http)
      .post('/auth/registro-token')
      .send({ email: 'nuevo@e2e.cl' })
      .expect(200);
    expect(typeof conEmail.body.token).toBe('string');
  });

  describe('con AUTH_REGISTRO_TOKEN_REQUERIDO=true', () => {
    beforeAll(() => {
      process.env.AUTH_REGISTRO_TOKEN_REQUERIDO = 'true';
    });
    afterAll(() => {
      delete process.env.AUTH_REGISTRO_TOKEN_REQUERIDO;
    });

    it('en modo requerido el token no se devuelve, solo llega un código por email', async () => {
      const r = await request(http)
        .post('/auth/registro-token')
        .send({ email: 'con-token@e2e.cl' })
        .expect(200);
      expect(r.body).toEqual({ enviado: true });
      expect(codigoDelEmail('con-token@e2e.cl')).toMatch(/^\d{6}$/);
    });

    it('el código se canjea una sola vez y se bloquea tras 5 intentos fallidos', async () => {
      await request(http).post('/auth/registro-token').send({ email: 'intentos@e2e.cl' }).expect(200);
      const codigo = codigoDelEmail('intentos@e2e.cl')!;
      const malo = codigo === '000000' ? '111111' : '000000';
      const canjear = (c: string) =>
        request(http).post('/auth/verificar-codigo-registro').send({ email: 'intentos@e2e.cl', codigo: c });

      for (let i = 0; i < 5; i++) await canjear(malo).expect(401);
      // Agotados los intentos, ni el código correcto sirve.
      await canjear(codigo).expect(401);

      // Uno nuevo reemplaza al anterior y sirve una sola vez.
      await request(http).post('/auth/registro-token').send({ email: 'intentos@e2e.cl' }).expect(200);
      const nuevo = codigoDelEmail('intentos@e2e.cl')!;
      const r = await canjear(nuevo).expect(200);
      expect(typeof r.body.token).toBe('string');
      await canjear(nuevo).expect(401);
    });

    it('RegistrarUsuario exige un token de registro válido y del mismo email', async () => {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email: 'sin-token@e2e.cl', nombre: 'X', password: 'secret123' })
        .expect(401);

      await request(http).post('/auth/registro-token').send({ email: 'con-token@e2e.cl' }).expect(200);
      const registroToken = (
        await request(http)
          .post('/auth/verificar-codigo-registro')
          .send({ email: 'con-token@e2e.cl', codigo: codigoDelEmail('con-token@e2e.cl') })
          .expect(200)
      ).body.token as string;

      // token ligado a con-token@ no sirve para otro email
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .set('X-Registro-Token', registroToken)
        .send({ email: 'distinto@e2e.cl', nombre: 'W', password: 'secret123' })
        .expect(401);

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
