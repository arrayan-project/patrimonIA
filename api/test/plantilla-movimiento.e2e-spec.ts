import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 15h — Plantillas de movimiento (GAPS.md G24): moldes personales y sin
 * fecha para registrar movimientos recurrentes.
 */
describe('Plantillas de movimiento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let otroToken: string;
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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, categoria_movimiento, plantilla_movimiento RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'plt@e2e.cl', nombre: 'Plt', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'plt@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'plt2@e2e.cl', nombre: 'Plt2', password: 'secret123' })
      .expect(201);
    otroToken = (
      await request(http).post('/auth/login').send({ email: 'plt2@e2e.cl', password: 'secret123' })
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

  const categorias = async () =>
    (await auth(request(http).get(`/hogares/${hogarId}/categorias-movimiento`)).expect(200))
      .body as Array<{ id: string; nombre: string }>;

  it('crea una plantilla de gasto con monto, elemento, categoría y glosa', async () => {
    const mercado = (await categorias()).find((c) => c.nombre === 'Mercado')!;
    const p = await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({
        nombre: 'Feria del sábado',
        tipo: 'GASTO',
        monto: 25_000,
        moneda: 'clp',
        elementoOrigenId: cuentaId,
        categoriaId: mercado.id,
        glosa: 'feria',
      })
      .expect(201);
    expect(p.body).toMatchObject({
      nombre: 'Feria del sábado',
      tipo: 'GASTO',
      monto: 25_000,
      moneda: 'CLP',
      elementoOrigenId: cuentaId,
      categoriaId: mercado.id,
      glosa: 'feria',
      orden: 0,
    });

    const lista = await auth(request(http).get('/usuarios/me/plantillas-movimiento')).expect(200);
    expect(lista.body).toHaveLength(1);
  });

  it('rechaza nombre duplicado (409)', async () => {
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'Feria del sábado', tipo: 'GASTO' })
      .expect(409);
  });

  it('rechaza categoría en una transferencia y categoría de tipo incompatible', async () => {
    const cats = await categorias();
    const mercado = cats.find((c) => c.nombre === 'Mercado')!;
    const sueldo = cats.find((c) => c.nombre === 'Sueldo')!;
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'Transf', tipo: 'TRANSFERENCIA', categoriaId: mercado.id })
      .expect(400);
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'Sueldo como gasto', tipo: 'GASTO', categoriaId: sueldo.id })
      .expect(400);
  });

  it('rechaza un elemento que no es del actor (403)', async () => {
    const ajena = (
      await request(http)
        .post('/comandos/RegistrarElementoPatrimonial')
        .set('Authorization', `Bearer ${otroToken}`)
        .send({
          nombre: 'Cuenta ajena',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 1,
          moneda: 'CLP',
        })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'Con cuenta ajena', tipo: 'GASTO', elementoOrigenId: ajena })
      .expect(403);
  });

  it('actualiza el monto y limpia la categoría con null', async () => {
    const id = (await auth(request(http).get('/usuarios/me/plantillas-movimiento')).expect(200))
      .body[0].id as string;
    const upd = await auth(request(http).post('/comandos/ActualizarPlantillaMovimiento'))
      .send({ plantillaId: id, monto: 30_000, categoriaId: null })
      .expect(200);
    expect(upd.body.monto).toBe(30_000);
    expect(upd.body.categoriaId).toBeNull();
  });

  it('otro usuario no puede tocar ni borrar una plantilla ajena (403)', async () => {
    const id = (await auth(request(http).get('/usuarios/me/plantillas-movimiento')).expect(200))
      .body[0].id as string;
    await request(http)
      .post('/comandos/ActualizarPlantillaMovimiento')
      .set('Authorization', `Bearer ${otroToken}`)
      .send({ plantillaId: id, monto: 1 })
      .expect(403);
  });

  it('elimina la plantilla y deja rastro en auditoría', async () => {
    const id = (await auth(request(http).get('/usuarios/me/plantillas-movimiento')).expect(200))
      .body[0].id as string;
    await auth(request(http).post('/comandos/EliminarPlantillaMovimiento'))
      .send({ plantillaId: id })
      .expect(200);
    const lista = await auth(request(http).get('/usuarios/me/plantillas-movimiento')).expect(200);
    expect(lista.body).toHaveLength(0);
    const rows = await prisma.auditoria.count({
      where: { comando: 'EliminarPlantillaMovimiento', entidad_id: id },
    });
    expect(rows).toBe(1);
  });
  it('D-5: el destino de una TRANSFERENCIA puede ser de otro miembro, si deja transferirle (D-2)', async () => {
    const otro = (r: request.Test) => r.set('Authorization', `Bearer ${otroToken}`);
    await auth(request(http).post('/comandos/InvitarMiembro'))
      .send({ hogarId, emailInvitado: 'plt2@e2e.cl' })
      .expect(201);
    const inv = (await otro(request(http).get('/usuarios/me/invitaciones?estado=PENDIENTE')).expect(200)).body[0];
    await otro(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv.id }).expect(200);
    const cuentaDe = async (nombre: string, existencia: 'FAMILIAR' | 'PRIVADA') =>
      (
        await otro(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({
            nombre, tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1, moneda: 'CLP',
            visibilidadPorTipo: { EXISTENCIA: existencia, VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
          })
          .expect(201)
      ).body.id as string;
    const compartida = await cuentaDe('Del miembro', 'FAMILIAR');
    const privada = await cuentaDe('Privada del miembro', 'PRIVADA');

    const ok = await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'A mi pareja', tipo: 'TRANSFERENCIA', elementoOrigenId: cuentaId, elementoDestinoId: compartida })
      .expect(201);
    expect(ok.body.elementoDestinoId).toBe(compartida);
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'A su cuenta privada', tipo: 'TRANSFERENCIA', elementoOrigenId: cuentaId, elementoDestinoId: privada })
      .expect(403);
    // El origen sigue siendo propio, y un INGRESO no puede ir a la cuenta de otro.
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'Desde la del miembro', tipo: 'TRANSFERENCIA', elementoOrigenId: compartida, elementoDestinoId: cuentaId })
      .expect(403);
    await auth(request(http).post('/comandos/CrearPlantillaMovimiento'))
      .send({ nombre: 'Ingreso ajeno', tipo: 'INGRESO', elementoDestinoId: compartida })
      .expect(403);
  });
});
