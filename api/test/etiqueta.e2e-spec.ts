import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 15i — Etiquetas de movimiento (GAPS.md G23): clasificación transversal,
 * personal y acumulativa (0..N por movimiento).
 */
describe('Etiquetas de movimiento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let otroToken: string;
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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, etiqueta, evento_etiqueta RESTART IDENTITY CASCADE',
    );
    for (const email of ['et@e2e.cl', 'et2@e2e.cl']) {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre: email, password: 'secret123' })
        .expect(201);
    }
    token = (
      await request(http).post('/auth/login').send({ email: 'et@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    otroToken = (
      await request(http).post('/auth/login').send({ email: 'et2@e2e.cl', password: 'secret123' })
    ).body.accessToken;
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

  const crearEtiqueta = async (nombre: string) =>
    (await auth(request(http).post('/comandos/CrearEtiqueta')).send({ nombre }).expect(201)).body
      .id as string;

  it('crea etiquetas y las lista; rechaza duplicados', async () => {
    await crearEtiqueta('reembolsable');
    await crearEtiqueta('viaje-2026');
    const lista = await auth(request(http).get('/usuarios/me/etiquetas')).expect(200);
    expect(lista.body.map((e: { nombre: string }) => e.nombre)).toEqual([
      'reembolsable',
      'viaje-2026',
    ]);
    await auth(request(http).post('/comandos/CrearEtiqueta')).send({ nombre: 'reembolsable' }).expect(409);
  });

  it('adjunta etiquetas al registrar un movimiento y al re-etiquetarlo', async () => {
    const lista = (await auth(request(http).get('/usuarios/me/etiquetas')).expect(200)).body as Array<{
      id: string;
      nombre: string;
    }>;
    const reemb = lista.find((e) => e.nombre === 'reembolsable')!.id;
    const viaje = lista.find((e) => e.nombre === 'viaje-2026')!.id;

    const ev = await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({
        tipo: 'GASTO',
        monto: 40_000,
        moneda: 'CLP',
        elementoOrigenId: cuentaId,
        fecha: '2026-03-10',
        etiquetaIds: [reemb, viaje],
      })
      .expect(201);
    expect([...ev.body.etiquetaIds].sort()).toEqual([reemb, viaje].sort());

    // re-etiquetar: solo 'viaje'
    await auth(request(http).post('/comandos/EtiquetarEvento'))
      .send({ eventoId: ev.body.id, etiquetaIds: [viaje] })
      .expect(200);
    const releido = await auth(request(http).get(`/eventos-financieros/${ev.body.id}`)).expect(200);
    expect(releido.body.etiquetaIds).toEqual([viaje]);

    // eliminar la etiqueta la quita del movimiento (ON DELETE CASCADE)
    await auth(request(http).post('/comandos/EliminarEtiqueta')).send({ etiquetaId: viaje }).expect(200);
    const sinEtq = await auth(request(http).get(`/eventos-financieros/${ev.body.id}`)).expect(200);
    expect(sinEtq.body.etiquetaIds).toEqual([]);
    const rows = await prisma.auditoria.count({
      where: { comando: 'EliminarEtiqueta', entidad_id: viaje },
    });
    expect(rows).toBe(1);
  });

  it('la corrección hereda las etiquetas del movimiento original', async () => {
    const reemb = await crearEtiqueta('para-corregir');
    const ev = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({
          tipo: 'GASTO',
          monto: 10_000,
          moneda: 'CLP',
          elementoOrigenId: cuentaId,
          fecha: '2026-03-11',
          etiquetaIds: [reemb],
        })
        .expect(201)
    ).body;
    const corr = await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
      .send({ eventoId: ev.id, nuevoMonto: 12_000, motivo: 'monto mal tipeado' })
      .expect(201);
    expect(corr.body.etiquetaIds).toEqual([reemb]);
  });

  it('no se puede etiquetar con una etiqueta ajena, un evento ajeno ni uno anulado', async () => {
    const propia = await crearEtiqueta('mia');
    const ajena = (
      await request(http)
        .post('/comandos/CrearEtiqueta')
        .set('Authorization', `Bearer ${otroToken}`)
        .send({ nombre: 'ajena' })
        .expect(201)
    ).body.id;
    const ev = (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 5_000, moneda: 'CLP', elementoOrigenId: cuentaId, fecha: '2026-03-12' })
        .expect(201)
    ).body;

    await auth(request(http).post('/comandos/EtiquetarEvento'))
      .send({ eventoId: ev.id, etiquetaIds: [ajena] })
      .expect(400);
    await request(http)
      .post('/comandos/EtiquetarEvento')
      .set('Authorization', `Bearer ${otroToken}`)
      .send({ eventoId: ev.id, etiquetaIds: [] })
      .expect(403);

    await auth(request(http).post('/comandos/AnularEventoFinanciero'))
      .send({ eventoId: ev.id, motivo: 'prueba de anulado' })
      .expect(200);
    await auth(request(http).post('/comandos/EtiquetarEvento'))
      .send({ eventoId: ev.id, etiquetaIds: [propia] })
      .expect(400);
  });
});
