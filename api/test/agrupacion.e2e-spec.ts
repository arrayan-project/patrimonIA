import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 15j — Agrupaciones de elementos (GAPS.md G23): carpetas de visualización
 * personales. Un elemento pertenece a lo sumo a una agrupación.
 */
describe('Agrupaciones de elementos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let otroToken: string;
  const els: string[] = [];

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, agrupacion_elemento, agrupacion_miembro RESTART IDENTITY CASCADE',
    );
    for (const email of ['ag@e2e.cl', 'ag2@e2e.cl']) {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre: email, password: 'secret123' })
        .expect(201);
    }
    token = (
      await request(http).post('/auth/login').send({ email: 'ag@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    otroToken = (
      await request(http).post('/auth/login').send({ email: 'ag2@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    for (const nombre of ['APV', 'Fondo', 'Cuenta corriente']) {
      els.push(
        (
          await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
            .send({
              nombre,
              tipo: 'fondo_mutuo',
              categoriaFuncional: 'INVERSION',
              valorInicial: 1_000_000,
              moneda: 'CLP',
            })
            .expect(201)
        ).body.id,
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const listar = async () =>
    (await auth(request(http).get('/usuarios/me/agrupaciones')).expect(200)).body as Array<{
      id: string;
      nombre: string;
      elementoIds: string[];
    }>;

  it('crea agrupaciones y rechaza nombre duplicado', async () => {
    await auth(request(http).post('/comandos/CrearAgrupacion')).send({ nombre: 'Inversiones' }).expect(201);
    await auth(request(http).post('/comandos/CrearAgrupacion')).send({ nombre: 'Emergencia' }).expect(201);
    await auth(request(http).post('/comandos/CrearAgrupacion')).send({ nombre: 'Inversiones' }).expect(409);
    expect((await listar()).map((a) => a.nombre)).toEqual(['Inversiones', 'Emergencia']);
  });

  it('asignar un elemento a otra agrupación lo mueve (una carpeta por elemento)', async () => {
    const [inv, eme] = await listar();
    await auth(request(http).post('/comandos/DefinirElementosAgrupacion'))
      .send({ agrupacionId: inv.id, elementoIds: [els[0], els[1]] })
      .expect(200);
    await auth(request(http).post('/comandos/DefinirElementosAgrupacion'))
      .send({ agrupacionId: eme.id, elementoIds: [els[1], els[2]] })
      .expect(200);

    const despues = await listar();
    expect(despues.find((a) => a.nombre === 'Inversiones')!.elementoIds).toEqual([els[0]]);
    expect([...despues.find((a) => a.nombre === 'Emergencia')!.elementoIds].sort()).toEqual(
      [els[1], els[2]].sort(),
    );
  });

  it('rechaza un elemento que no es del actor', async () => {
    const ajeno = (
      await request(http)
        .post('/comandos/RegistrarElementoPatrimonial')
        .set('Authorization', `Bearer ${otroToken}`)
        .send({ nombre: 'Ajeno', tipo: 'efectivo', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    const [inv] = await listar();
    await auth(request(http).post('/comandos/DefinirElementosAgrupacion'))
      .send({ agrupacionId: inv.id, elementoIds: [ajeno] })
      .expect(403);
  });

  it('otro usuario no puede tocar una agrupación ajena', async () => {
    const [inv] = await listar();
    await request(http)
      .post('/comandos/ActualizarAgrupacion')
      .set('Authorization', `Bearer ${otroToken}`)
      .send({ agrupacionId: inv.id, nombre: 'Hackeada' })
      .expect(403);
  });

  it('eliminar la agrupación deja los elementos sin agrupar y audita', async () => {
    const [inv] = await listar();
    await auth(request(http).post('/comandos/EliminarAgrupacion'))
      .send({ agrupacionId: inv.id })
      .expect(200);
    const despues = await listar();
    expect(despues.map((a) => a.nombre)).toEqual(['Emergencia']);
    const huerfano = await prisma.agrupacion_miembro.count({ where: { elemento_id: els[0] } });
    expect(huerfano).toBe(0);
    const rows = await prisma.auditoria.count({
      where: { comando: 'EliminarAgrupacion', entidad_id: inv.id },
    });
    expect(rows).toBe(1);
  });
});
