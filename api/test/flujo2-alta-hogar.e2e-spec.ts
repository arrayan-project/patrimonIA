import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Validación de Fase 1 (BUILD_INSTRUCTIONS): un usuario se registra, crea un
 * hogar, invita a otro, y ese otro acepta — todo contra el backend real, con
 * las filas correspondientes verificables en `auditoria`.
 */
describe('Flujo 2 — Alta de hogar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.enableShutdownHooks();
    await app.init();

    prisma = app.get(PrismaService);
    http = app.getHttpServer();

    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const registrar = (email: string, nombre: string) =>
    request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email, nombre, password: 'secret123' })
      .expect(201);

  const login = async (email: string): Promise<string> => {
    const res = await request(http)
      .post('/auth/login')
      .send({ email, password: 'secret123' })
      .expect(200);
    return res.body.accessToken as string;
  };

  it('recorre registro → crear hogar → invitar → aceptar y deja rastro en auditoría', async () => {
    // 1. RegistrarUsuario (x2)
    const ana = await registrar('ana@e2e.cl', 'Ana');
    await registrar('beto@e2e.cl', 'Beto');
    const anaId = ana.body.id as string;

    // 2. login + 3. CrearHogar (Ana queda ADMINISTRADOR)
    const anaTok = await login('ana@e2e.cl');
    const hogarRes = await request(http)
      .post('/comandos/CrearHogar')
      .set('Authorization', `Bearer ${anaTok}`)
      .send({ nombre: 'Hogar E2E' })
      .expect(201);
    const hogarId = hogarRes.body.id as string;

    const miembrosIniciales = await request(http)
      .get(`/hogares/${hogarId}/miembros`)
      .set('Authorization', `Bearer ${anaTok}`)
      .expect(200);
    expect(miembrosIniciales.body).toHaveLength(1);
    expect(miembrosIniciales.body[0]).toMatchObject({ email: 'ana@e2e.cl', rol: 'ADMINISTRADOR' });

    // 4. InvitarMiembro
    const invRes = await request(http)
      .post('/comandos/InvitarMiembro')
      .set('Authorization', `Bearer ${anaTok}`)
      .send({ hogarId, emailInvitado: 'beto@e2e.cl' })
      .expect(201);
    const invitacionId = invRes.body.id as string;
    expect(invRes.body.estado).toBe('PENDIENTE');

    // 5. El invitado ve la invitación y 6. la acepta
    const betoTok = await login('beto@e2e.cl');
    const pendientes = await request(http)
      .get('/usuarios/me/invitaciones?estado=PENDIENTE')
      .set('Authorization', `Bearer ${betoTok}`)
      .expect(200);
    expect(pendientes.body).toHaveLength(1);
    expect(pendientes.body[0].id).toBe(invitacionId);

    const membresia = await request(http)
      .post('/comandos/AceptarInvitacion')
      .set('Authorization', `Bearer ${betoTok}`)
      .send({ invitacionId })
      .expect(200);
    expect(membresia.body).toMatchObject({ hogarId, rol: 'MIEMBRO', estado: 'ACTIVA' });

    // El hogar ahora tiene 2 miembros
    const miembrosFinales = await request(http)
      .get(`/hogares/${hogarId}/miembros`)
      .set('Authorization', `Bearer ${betoTok}`)
      .expect(200);
    expect(miembrosFinales.body).toHaveLength(2);

    // Auditoría: una entrada por comando, en la misma transacción
    const entradas = await prisma.auditoria.findMany({ orderBy: { fecha_hora: 'asc' } });
    expect(entradas.map((e) => e.comando)).toEqual([
      'RegistrarUsuario',
      'RegistrarUsuario',
      'CrearHogar',
      'InvitarMiembro',
      'AceptarInvitacion',
    ]);

    const crearHogar = entradas.find((e) => e.comando === 'CrearHogar')!;
    expect(crearHogar.usuario_id).toBe(anaId);
    expect(crearHogar.entidad_tipo).toBe('HOGAR');
    expect(crearHogar.entidad_id).toBe(hogarId);

    // AceptarInvitacion embebe la política UnirseAHogar (entidad relacionada = Membresia)
    const aceptar = entradas.find((e) => e.comando === 'AceptarInvitacion')!;
    expect(aceptar.valor_anterior).toEqual({ estado: 'PENDIENTE' });
    expect(aceptar.valor_posterior).toEqual({ estado: 'ACEPTADA' });
    expect(aceptar.entidad_relacionada_tipo).toBe('MEMBRESIA');
    expect(aceptar.entidad_relacionada_id).toBe(membresia.body.id);
  });

  it('rechaza comandos sin JWT (API_DESIGN: Bearer sin excepción)', async () => {
    await request(http).post('/comandos/CrearHogar').send({ nombre: 'x' }).expect(401);
  });

  it('solo un administrador puede invitar (autorización en el Application Service)', async () => {
    const betoTok = await login('beto@e2e.cl');
    const hogar = await prisma.hogar.findFirst();
    await request(http)
      .post('/comandos/InvitarMiembro')
      .set('Authorization', `Bearer ${betoTok}`)
      .send({ hogarId: hogar!.id, emailInvitado: 'ana@e2e.cl' })
      .expect(403);
  });
});
