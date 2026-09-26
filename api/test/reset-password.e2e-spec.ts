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
/** Extrae el token JWT del cuerpo del último email a `destinatario`. */
const tokenDelEmail = (destinatario: string) => {
  const email = [...emailsEnviados].reverse().find((e) => e.a === destinatario);
  return email?.cuerpo.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)?.[0];
};

/** Recuperación de contraseña olvidada (GAPS.md G31). */
describe('Reset de contraseña (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;

  const login = (password: string) =>
    request(http).post('/auth/login').send({ email: 'reset@e2e.cl', password });

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, idempotencia RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'reset@e2e.cl', nombre: 'Reset', password: 'vieja1234' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('email inexistente: misma respuesta y no se envía nada', async () => {
    const r = await request(http)
      .post('/auth/solicitar-reset-password')
      .send({ email: 'nadie@e2e.cl' })
      .expect(200);
    expect(r.body).toEqual({ enviado: true });
    expect(emailsEnviados.some((e) => e.a === 'nadie@e2e.cl')).toBe(false);
  });

  it('flujo completo: el token llega por email, cambia la contraseña y cierra sesiones', async () => {
    const sesionVieja = (await login('vieja1234').expect(200)).body.accessToken;
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${sesionVieja}`).expect(200);

    const r = await request(http)
      .post('/auth/solicitar-reset-password')
      .send({ email: 'reset@e2e.cl' })
      .expect(200);
    expect(r.body).toEqual({ enviado: true }); // el token no viaja en la respuesta
    const tokenReset = tokenDelEmail('reset@e2e.cl');
    expect(tokenReset).toBeDefined();

    // El token de reset no sirve como sesión.
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${tokenReset}`).expect(401);

    await request(http)
      .post('/auth/reset-password')
      .send({ token: tokenReset, nuevaPassword: 'nueva1234' })
      .expect(200);

    await login('vieja1234').expect(401);
    const sesionNueva = (await login('nueva1234').expect(200)).body.accessToken;
    // La sesión emitida antes del reset quedó invalidada; la nueva funciona.
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${sesionVieja}`).expect(401);
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${sesionNueva}`).expect(200);

    // Un solo uso: reutilizar el token falla.
    await request(http)
      .post('/auth/reset-password')
      .send({ token: tokenReset, nuevaPassword: 'otra12345' })
      .expect(401);
  });

  it('rechaza un token de sesión o un token inválido como token de reset', async () => {
    const sesion = (await login('nueva1234').expect(200)).body.accessToken;
    await request(http)
      .post('/auth/reset-password')
      .send({ token: sesion, nuevaPassword: 'otra12345' })
      .expect(401);
    await request(http)
      .post('/auth/reset-password')
      .send({ token: 'basura', nuevaPassword: 'otra12345' })
      .expect(401);
  });

  it('valida el largo mínimo de la nueva contraseña', async () => {
    await request(http)
      .post('/auth/reset-password')
      .send({ token: 'x', nuevaPassword: 'corta' })
      .expect(400);
  });
});
