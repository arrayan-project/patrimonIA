import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Migración 018 — catálogo de tipos de elemento patrimonial del hogar.
 */
describe('Tipos de elemento patrimonial (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token = '';
  let hogarId = '';

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, tipo_elemento, categoria_movimiento RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'te@e2e.cl', nombre: 'T', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'te@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    hogarId = (
      await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crear el hogar siembra el catálogo por defecto', async () => {
    const tipos = (await auth(request(http).get(`/hogares/${hogarId}/tipos-elemento`)).expect(200))
      .body;
    expect(tipos.length).toBeGreaterThanOrEqual(10);
    const cc = tipos.find((t: { nombre: string }) => t.nombre === 'Cuenta corriente');
    expect(cc.categoriaSugerida).toBe('LIQUIDEZ');
  });

  it('CRUD + duplicado + archivar', async () => {
    const t = (
      await auth(request(http).post('/comandos/CrearTipoElemento'))
        .send({ hogarId, nombre: 'Billetera digital', categoriaSugerida: 'LIQUIDEZ' })
        .expect(201)
    ).body;
    await auth(request(http).post('/comandos/CrearTipoElemento'))
      .send({ hogarId, nombre: 'Billetera digital' })
      .expect(409);

    const upd = await auth(request(http).post('/comandos/ActualizarTipoElemento'))
      .send({ tipoId: t.id, categoriaSugerida: null })
      .expect(200);
    expect(upd.body.categoriaSugerida).toBeNull();

    await auth(request(http).post('/comandos/ArchivarTipoElemento')).send({ tipoId: t.id }).expect(200);
    const activos = (await auth(request(http).get(`/hogares/${hogarId}/tipos-elemento`)).expect(200))
      .body;
    expect(activos.some((x: { id: string }) => x.id === t.id)).toBe(false);
  });

  it('un no-miembro no ve ni administra el catálogo', async () => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'ajeno-te@e2e.cl', nombre: 'A', password: 'secret123' })
      .expect(201);
    const otro = (
      await request(http).post('/auth/login').send({ email: 'ajeno-te@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .get(`/hogares/${hogarId}/tipos-elemento`)
      .set('Authorization', `Bearer ${otro}`)
      .expect(403);
  });
});
