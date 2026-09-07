import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 10 — Consolidación Patrimonial (DDD Sección Q) y métricas del hogar (N).
 * Desglose por moneda, sin total único (GAPS.md G7).
 */
describe('Consolidación y métricas del hogar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA: string;
  let tokenB: string;
  let hogarId: string;
  let cuentaA: string;
  let inversionA: string;

  const A = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
  const B = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);
  const elem = (token: string, body: Record<string, unknown>) =>
    request(http)
      .post('/comandos/RegistrarElementoPatrimonial')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado RESTART IDENTITY CASCADE',
    );
    const reg = async (email: string) => {
      await request(http)
        .post('/comandos/RegistrarUsuario')
        .send({ email, nombre: email, password: 'secret123' })
        .expect(201);
      return (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body
        .accessToken as string;
    };
    tokenA = await reg('a@e2e.cl');
    tokenB = await reg('b@e2e.cl');

    hogarId = (await A(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201))
      .body.id;
    await A(request(http).post('/comandos/InvitarMiembro'))
      .send({ hogarId, emailInvitado: 'b@e2e.cl' })
      .expect(201);
    const inv = (
      await B(request(http).get('/usuarios/me/invitaciones?estado=PENDIENTE')).expect(200)
    ).body[0];
    await B(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv.id }).expect(200);

    cuentaA = (
      await elem(tokenA, {
        nombre: 'Cuenta A',
        tipo: 'cuenta_corriente',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial: 1_000_000,
        moneda: 'CLP',
        participaConsolidacion: true,
        participaValorLiquido: true,
      })
    ).body.id;
    inversionA = (
      await elem(tokenA, {
        nombre: 'Depto',
        tipo: 'inmueble',
        categoriaFuncional: 'ACTIVO',
        valorInicial: 50_000_000,
        moneda: 'CLP',
        participaConsolidacion: true,
      })
    ).body.id;
    await elem(tokenA, {
      nombre: 'Deuda',
      tipo: 'deuda',
      categoriaFuncional: 'DEUDA',
      valorPendiente: 3_000_000,
      moneda: 'CLP',
      participaConsolidacion: true,
    });
    // NO participa en consolidación → no debe aparecer
    await elem(tokenA, {
      nombre: 'Cuenta oculta',
      tipo: 'cuenta_corriente',
      categoriaFuncional: 'LIQUIDEZ',
      valorInicial: 500_000,
      moneda: 'CLP',
    });
    await elem(tokenB, {
      nombre: 'Cuenta B',
      tipo: 'cuenta_corriente',
      categoriaFuncional: 'LIQUIDEZ',
      valorInicial: 2_000_000,
      moneda: 'CLP',
      participaConsolidacion: true,
    });

    // objetivo del hogar (personal de A) con reserva
    const objId = (
      await A(request(http).post('/comandos/CrearObjetivoFinanciero'))
        .send({ nombre: 'Viaje', montoObjetivo: 10_000_000 })
        .expect(201)
    ).body.id;
    const asgId = (
      await A(request(http).post('/comandos/CrearAsignacion'))
        .send({ nombre: 'Viaje', objetivoId: objId })
        .expect(201)
    ).body.id;
    await A(request(http).post('/comandos/CrearReserva'))
      .send({ asignacionId: asgId, elementoOrigenId: inversionA, monto: 4_000_000 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('patrimonio-consolidado: suma elementos participantes de todos los miembros, una vez', async () => {
    const c = await A(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200);
    const clp = c.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp.patrimonioNeto).toBe(1_000_000 + 50_000_000 - 3_000_000 + 2_000_000); // 50M
    expect(clp.activos).toBe(53_000_000);
    expect(clp.pasivos).toBe(3_000_000);
    expect(clp.valorLiquido).toBe(1_000_000); // solo Cuenta A marcada como líquida
    expect(c.body.elementos).toBe(4); // cuentaA, depto, deuda, cuentaB (no la oculta)
    expect(c.body.miembros).toBe(2);
  });

  it('métricas: distribución, liquidez y avance de objetivos del hogar', async () => {
    const m = await B(request(http).get(`/hogares/${hogarId}/metricas`)).expect(200);
    const clp = m.body.porMoneda.find((x: { moneda: string }) => x.moneda === 'CLP');
    expect(clp.patrimonioNeto).toBe(50_000_000);
    const liq = clp.distribucionPorActivo.find((d: { categoria: string }) => d.categoria === 'LIQUIDEZ');
    expect(liq.valor).toBe(3_000_000); // 1M A + 2M B
    expect(clp.distribucionPorPasivo[0]).toMatchObject({ categoria: 'DEUDA', valor: 3_000_000 });
    expect(clp.liquidez).toBeCloseTo(1_000_000 / 53_000_000, 3);

    expect(m.body.objetivos.total).toBe(1);
    expect(m.body.objetivos.progresoTotal).toBe(4_000_000);
    expect(m.body.objetivos.avancePorcentaje).toBe(40);
  });

  it('vista consolidada de eventos: 1 fila por evento, corrección plegada', async () => {
    await A(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'TRANSFERENCIA', monto: 200_000, moneda: 'CLP', elementoOrigenId: cuentaA, elementoDestinoId: inversionA, fecha: '2026-02-01' })
      .expect(201);
    const gastoId = (
      await A(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 100_000, moneda: 'CLP', elementoOrigenId: cuentaA, fecha: '2026-02-05' })
        .expect(201)
    ).body.id;
    await A(request(http).post('/comandos/CorregirEventoFinanciero'))
      .send({ eventoId: gastoId, nuevoMonto: 80_000, motivo: 'era menos' })
      .expect(201);

    const ev = await A(request(http).get(`/hogares/${hogarId}/eventos-financieros`)).expect(200);
    const transfer = ev.body.filter((e: { tipo: string }) => e.tipo === 'TRANSFERENCIA');
    expect(transfer).toHaveLength(1); // colapsada, no 2 patas
    expect(transfer[0].elementos.length).toBe(2);

    const gasto = ev.body.find((e: { eventoId: string }) => e.eventoId === gastoId);
    expect(gasto.corregido).toBe(true);
    expect(gasto.montoEfectivo).toBe(80_000); // 100k con la corrección plegada
    expect(gasto.glosa).toBeNull();
    expect(gasto.elementos[0]).toMatchObject({ id: cuentaA, nombre: 'Cuenta A' });
    // el compensatorio no aparece como fila propia
    expect(ev.body.every((e: { eventoId?: string }) => e.eventoId !== undefined)).toBe(true);
  });

  it('§M: un movimiento en una cuenta privada de otro miembro no aparece para el actor', async () => {
    const privadaB = (
      await elem(tokenB, {
        nombre: 'Cuenta secreta de B',
        tipo: 'cuenta_corriente',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial: 300_000,
        moneda: 'CLP',
      })
    ).body.id;
    const gastoB = (
      await B(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'GASTO', monto: 50_000, moneda: 'CLP', elementoOrigenId: privadaB, glosa: 'algo mío', fecha: '2026-03-01' })
        .expect(201)
    ).body.id;

    const paraA = await A(request(http).get(`/hogares/${hogarId}/eventos-financieros`)).expect(200);
    expect(paraA.body.some((e: { eventoId: string }) => e.eventoId === gastoB)).toBe(false);

    const paraB = await B(request(http).get(`/hogares/${hogarId}/eventos-financieros`)).expect(200);
    const propio = paraB.body.find((e: { eventoId: string }) => e.eventoId === gastoB);
    expect(propio).toBeDefined();
    expect(propio.glosa).toBe('algo mío');
  });

  it('un no-miembro no accede', async () => {
    const otro = (
      await (async () => {
        await request(http)
          .post('/comandos/RegistrarUsuario')
          .send({ email: 'x@e2e.cl', nombre: 'X', password: 'secret123' })
          .expect(201);
        return request(http).post('/auth/login').send({ email: 'x@e2e.cl', password: 'secret123' });
      })()
    ).body.accessToken;
    await request(http)
      .get(`/hogares/${hogarId}/metricas`)
      .set('Authorization', `Bearer ${otro}`)
      .expect(403);
  });
});
