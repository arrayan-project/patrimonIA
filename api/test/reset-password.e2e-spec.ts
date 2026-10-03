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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, idempotencia, codigo_verificacion RESTART IDENTITY CASCADE',
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

  const reset = (codigo: string | undefined, nuevaPassword: string) =>
    request(http).post('/auth/reset-password').send({ email: 'reset@e2e.cl', codigo, nuevaPassword });

  it('flujo completo: el código llega por email, cambia la contraseña y cierra sesiones', async () => {
    const sesionVieja = (await login('vieja1234').expect(200)).body.accessToken;
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${sesionVieja}`).expect(200);

    const r = await request(http)
      .post('/auth/solicitar-reset-password')
      .send({ email: 'reset@e2e.cl' })
      .expect(200);
    expect(r.body).toEqual({ enviado: true }); // el código no viaja en la respuesta
    const codigo = codigoDelEmail('reset@e2e.cl');
    expect(codigo).toMatch(/^\d{6}$/);

    await reset(codigo, 'nueva1234').expect(200);

    await login('vieja1234').expect(401);
    const sesionNueva = (await login('nueva1234').expect(200)).body.accessToken;
    // La sesión emitida antes del reset quedó invalidada; la nueva funciona.
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${sesionVieja}`).expect(401);
    await request(http).get('/usuarios/me/notificaciones').set('Authorization', `Bearer ${sesionNueva}`).expect(200);

    // Un solo uso: reutilizar el código falla.
    await reset(codigo, 'otra12345').expect(401);
  });

  it('tras 5 intentos fallidos el código deja de servir', async () => {
    await request(http).post('/auth/solicitar-reset-password').send({ email: 'reset@e2e.cl' }).expect(200);
    const codigo = codigoDelEmail('reset@e2e.cl')!;
    const malo = codigo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await reset(malo, 'otra12345').expect(401);
    await reset(codigo, 'otra12345').expect(401);
    await login('nueva1234').expect(200);
  });

  it('un código de registro no sirve para el reset', async () => {
    await request(http).post('/auth/registro-token').send({ email: 'reset@e2e.cl' }).expect(200);
    await reset(codigoDelEmail('reset@e2e.cl'), 'otra12345').expect(401);
  });

  it('valida el formato del código y el largo mínimo de la nueva contraseña', async () => {
    await reset('abc', 'otra12345').expect(400);
    await reset('123456', 'corta').expect(400);
  });

  it('G34: el login no distingue mayúsculas en el email', async () => {
    await request(http).post('/auth/login').send({ email: 'Reset@E2E.cl', password: 'nueva1234' }).expect(200);
  });
});
