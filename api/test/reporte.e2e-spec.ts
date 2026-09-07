import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Fase 16 — Reportes financieros (proyección de lectura): resumen de movimientos
 * por período (mes) y por año, con desglose por rubro. GAPS.md G27.
 */
describe('Reportes financieros (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let hogarId: string;
  let cuentaId: string;
  let mercadoId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const gasto = (monto: number, fecha: string, categoriaId?: string) =>
    auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto, moneda: 'CLP', elementoOrigenId: cuentaId, fecha, ...(categoriaId ? { categoriaId } : {}) })
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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, categoria_movimiento, evento_etiqueta, etiqueta RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'rep@e2e.cl', nombre: 'Rep', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'rep@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    hogarId = (
      await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)
    ).body.id;
    cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        // fechaAlta pasada: el evento SALDO_INICIAL (§G29) no debe caer en los
        // períodos que este spec consulta (marzo/mayo 2026, año 2026, mes actual).
        .send({ nombre: 'Cuenta', tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 5_000_000, moneda: 'CLP', fechaAlta: '2024-01-01' })
        .expect(201)
    ).body.id;
    const cats = (
      await auth(request(http).get(`/hogares/${hogarId}/categorias-movimiento`)).expect(200)
    ).body as Array<{ id: string; nombre: string }>;
    mercadoId = cats.find((c) => c.nombre === 'Mercado')!.id;
    const sueldoId = cats.find((c) => c.nombre === 'Sueldo')!.id;

    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'INGRESO', monto: 500_000, moneda: 'CLP', elementoDestinoId: cuentaId, fecha: '2026-03-05', categoriaId: sueldoId })
      .expect(201);
    await gasto(40_000, '2026-03-10', mercadoId);
    await gasto(20_000, '2026-03-20');
    await gasto(999_000, '2026-05-01'); // fuera del mes de marzo
  });

  afterAll(async () => {
    await app.close();
  });

  it('resumen del mes: totales por moneda y desglose por rubro', async () => {
    const r = await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-03-01&hasta=2026-03-31&alcance=mios'),
    ).expect(200);
    const clp = r.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp).toMatchObject({ ingresos: 500_000, gastos: 60_000, balance: 440_000 });
    expect(r.body.movimientos).toHaveLength(3);
    const mercado = r.body.porRubro.find((x: { nombre: string }) => x.nombre === 'Mercado');
    expect(mercado).toMatchObject({ tipo: 'GASTO', total: 40_000 });
    const sin = r.body.porRubro.find((x: { nombre: string }) => x.nombre === 'Sin clasificar');
    expect(sin).toMatchObject({ tipo: 'GASTO', total: 20_000 });
  });

  it('la corrección de un movimiento se refleja en el monto neto', async () => {
    const antes = await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-03-01&hasta=2026-03-31&alcance=mios'),
    ).expect(200);
    const evMercado = antes.body.movimientos.find(
      (m: { categoriaId: string | null }) => m.categoriaId === mercadoId,
    );
    await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
      .send({ eventoId: evMercado.eventoId, nuevoMonto: 30_000, motivo: 'monto mal tipeado' })
      .expect(201);

    const despues = await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-03-01&hasta=2026-03-31&alcance=mios'),
    ).expect(200);
    const clp = despues.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp.gastos).toBe(50_000); // 30k + 20k
    const mercado = despues.body.porRubro.find((x: { nombre: string }) => x.nombre === 'Mercado');
    expect(mercado.total).toBe(30_000);
    expect(despues.body.movimientos.find((m: { corregido: boolean }) => m.corregido)).toBeTruthy();
  });

  it('resumen anual: un balde por mes', async () => {
    const r = await auth(
      request(http).get('/usuarios/me/resumen-anual?anio=2026&alcance=mios'),
    ).expect(200);
    expect(r.body.meses).toHaveLength(12);
    const marzo = r.body.meses[2].porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(marzo.ingresos).toBe(500_000);
    const mayo = r.body.meses[4].porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(mayo.gastos).toBe(999_000);
    expect(r.body.meses[0].porMoneda).toHaveLength(0); // enero sin movimientos
  });

  it('valida parámetros y alcance', async () => {
    await auth(request(http).get('/usuarios/me/resumen-financiero?hasta=2026-03-31')).expect(400);
    await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-03-01&hasta=2026-03-31&alcance=hogar'),
    ).expect(400); // falta hogarId
    // hogar ajeno
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'rep2@e2e.cl', nombre: 'Rep2', password: 'secret123' })
      .expect(201);
    const otro = (
      await request(http).post('/auth/login').send({ email: 'rep2@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    const hogarAjeno = (
      await request(http)
        .post('/comandos/CrearHogar')
        .set('Authorization', `Bearer ${otro}`)
        .send({ nombre: 'Otra' })
        .expect(201)
    ).body.id;
    await auth(
      request(http).get(
        `/usuarios/me/resumen-financiero?desde=2026-03-01&hasta=2026-03-31&alcance=hogar&hogarId=${hogarAjeno}`,
      ),
    ).expect(403);
  });

  it('una TRANSFERENCIA aparece como fila neutra y no toca los totales', async () => {
    // Segunda cuenta del mismo usuario y una transferencia entre ambas en abril.
    const ahorroId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Ahorro', tipo: 'cuenta_vista', categoriaFuncional: 'RESERVA', valorInicial: 0, moneda: 'CLP' })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({
        tipo: 'TRANSFERENCIA',
        monto: 100_000,
        moneda: 'CLP',
        elementoOrigenId: cuentaId,
        elementoDestinoId: ahorroId,
        fecha: '2026-04-10',
      })
      .expect(201);

    const r = await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-04-01&hasta=2026-04-30&alcance=mios'),
    ).expect(200);

    const transfer = r.body.movimientos.find(
      (m: { tipo: string }) => m.tipo === 'TRANSFERENCIA',
    );
    expect(transfer).toBeTruthy();
    expect(transfer.monto).toBe(100_000);
    expect(transfer.efectoPropio).toBe(0); // salió de una cuenta propia, entró en otra
    // No cuenta como ingreso/gasto ni aparece en el desglose por rubro.
    expect(r.body.porMoneda).toHaveLength(0);
    expect(r.body.porRubro).toHaveLength(0);
  });

  it('el saldo inicial de una cuenta cuenta como ingreso del mes en que se abre (§G29)', async () => {
    const nueva = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre: 'Cuenta nueva',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 800_000,
          moneda: 'CLP',
          fechaAlta: '2026-07-15',
        })
        .expect(201)
    ).body;
    expect(nueva.valorVigente).toBe(800_000); // el elemento queda en su valor

    const r = await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-07-01&hasta=2026-07-31&alcance=mios'),
    ).expect(200);
    const clp = r.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    expect(clp).toMatchObject({ ingresos: 800_000, gastos: 0, balance: 800_000 });
    const fila = r.body.movimientos.find((m: { tipo: string }) => m.tipo === 'SALDO_INICIAL');
    expect(fila).toMatchObject({ monto: 800_000, glosa: 'Saldo inicial', efectoPropio: null });
    const rubro = r.body.porRubro.find((x: { nombre: string }) => x.nombre === 'Saldo inicial');
    expect(rubro).toMatchObject({ tipo: 'INGRESO', total: 800_000 });

    // No se puede anular ni corregir.
    await auth(request(http).post('/comandos/AnularEventoFinanciero'))
      .send({ eventoId: fila.eventoId, motivo: 'no debería dejar' })
      .expect(400);
  });

  it('un activo (no LIQUIDEZ/RESERVA) NO genera evento de saldo inicial', async () => {
    await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
      .send({
        nombre: 'Auto',
        tipo: 'vehiculo',
        categoriaFuncional: 'ACTIVO',
        valorInicial: 9_000_000,
        moneda: 'CLP',
        fechaAlta: '2026-08-10',
      })
      .expect(201);
    const r = await auth(
      request(http).get('/usuarios/me/resumen-financiero?desde=2026-08-01&hasta=2026-08-31&alcance=mios'),
    ).expect(200);
    expect(r.body.movimientos.filter((m: { tipo: string }) => m.tipo === 'SALDO_INICIAL')).toHaveLength(0);
  });
});
