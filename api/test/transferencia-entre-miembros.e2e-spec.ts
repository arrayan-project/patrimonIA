import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Transferencia entre miembros del hogar registrada "por ambos" (G33, D-8).
 *
 * Bug de una versión anterior: A transfería a B, los dos lo registraban y los
 * gastos del hogar quedaban inflados. Hoy:
 * - una TRANSFERENCIA es un único evento y no suma a ingresos ni a gastos
 *   (REQUISITES §8, §13; DDD §X.3 "Transferencias en las lecturas");
 * - solo la registra quien envía: el origen debe ser propio (D-8, Recibí →
 *   "De alguien del hogar" no crea evento).
 * Con D-8, en Recibí → "De alguien del hogar" B ve la transferencia que A ya
 * registró hacia su cuenta y no crea nada. El backend no bloquea que B anote
 * además un INGRESO (duplicaría el ingreso, no el gasto): lo evita la app,
 * que ya no ofrece ese camino (GAPS G33, bloque 8).
 */
describe('Transferencia entre miembros del hogar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA: string;
  let tokenB: string;
  let hogarId: string;
  let cuentaA: string;
  let cuentaB: string;
  let presupuestoId: string;

  const A = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
  const B = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);
  const MARZO = 'desde=2026-03-01&hasta=2026-03-31';

  /** Totales CLP de marzo 2026 (sin filas de INGRESO/GASTO, porMoneda viene vacío). */
  const totales = async (quien: typeof A, alcance: 'mios' | 'hogar') => {
    const extra = alcance === 'hogar' ? `&hogarId=${hogarId}` : '';
    const r = await quien(
      request(http).get(`/usuarios/me/resumen-financiero?${MARZO}&alcance=${alcance}${extra}`),
    ).expect(200);
    const clp = r.body.porMoneda.find((m: { moneda: string }) => m.moneda === 'CLP');
    return {
      ingresos: (clp?.ingresos ?? 0) as number,
      gastos: (clp?.gastos ?? 0) as number,
      movimientos: r.body.movimientos as Array<{ tipo: string; monto: number }>,
    };
  };
  const gastosPresupuesto = async () =>
    (await A(request(http).get(`/presupuestos/${presupuestoId}/desviacion`)).expect(200)).body.real
      .gastos as number;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, categoria_movimiento, presupuesto RESTART IDENTITY CASCADE',
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

    // fechaAlta pasada: el SALDO_INICIAL (§G29) no cae en marzo 2026.
    // Nivel D-2 "Que puedan transferirme" (el de la app por defecto): EXISTENCIA familiar.
    const cuenta = async (quien: typeof A, nombre: string) =>
      (
        await quien(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({
            nombre, tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1_000_000, moneda: 'CLP', fechaAlta: '2024-01-01',
            visibilidadPorTipo: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
          })
          .expect(201)
      ).body.id as string;
    cuentaA = await cuenta(A, 'Cuenta A');
    cuentaB = await cuenta(B, 'Cuenta B');

    presupuestoId = (
      await A(request(http).post('/comandos/CrearPresupuesto'))
        .send({ tipo: 'FAMILIAR', hogarId, periodicidad: 'ESPECIFICO', fechaInicio: '2026-03-01', fechaFin: '2026-03-31' })
        .expect(201)
    ).body.id;

    // A transfiere 50.000 a B y lo registra (el destino de un co-miembro es válido, G6).
    await A(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'TRANSFERENCIA', monto: 50_000, moneda: 'CLP', elementoOrigenId: cuentaA, elementoDestinoId: cuentaB, fecha: '2026-03-15' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('la transferencia de A no suma gastos a A, a B ni al hogar, y el hogar la ve una vez', async () => {
    expect((await totales(A, 'mios')).gastos).toBe(0);
    expect((await totales(B, 'mios')).gastos).toBe(0);
    const hogar = await totales(A, 'hogar');
    expect(hogar.gastos).toBe(0);
    expect(hogar.movimientos.filter((m) => m.tipo === 'TRANSFERENCIA')).toHaveLength(1);
    expect(await gastosPresupuesto()).toBe(0);
  });

  it('D-2: A no puede transferir a una cuenta que B no comparte con el hogar ("Nada")', async () => {
    const privada = (
      await B(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Privada B', tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'CLP', fechaAlta: '2024-01-01' })
        .expect(201)
    ).body.id as string;
    const r = await A(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'TRANSFERENCIA', monto: 1_000, moneda: 'CLP', elementoOrigenId: cuentaA, elementoDestinoId: privada, fecha: '2026-03-16' })
      .expect(403);
    expect(r.body.codigo).toBe('DESTINO_NO_PERMITIDO');
  });

  it('B no puede registrar la misma transferencia: el origen debe ser propio', async () => {
    await B(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'TRANSFERENCIA', monto: 50_000, moneda: 'CLP', elementoOrigenId: cuentaA, elementoDestinoId: cuentaB, fecha: '2026-03-15' })
      .expect(403);
    const hogar = await totales(A, 'hogar');
    expect(hogar.movimientos.filter((m) => m.tipo === 'TRANSFERENCIA')).toHaveLength(1);
  });

  it('D-8: B ve la transferencia de A en su cuenta sin registrar nada, y nadie suma ingresos', async () => {
    const enCuentaB = (
      await B(request(http).get(`/eventos-financieros?elemento=${cuentaB}`)).expect(200)
    ).body as Array<{ tipo: string; monto: number }>;
    expect(enCuentaB.filter((e) => e.tipo === 'TRANSFERENCIA').map((e) => e.monto)).toEqual([50_000]);
    expect((await totales(B, 'mios')).ingresos).toBe(0);
    expect((await totales(A, 'hogar')).ingresos).toBe(0);
  });

  it('si B además la anota como INGRESO, los gastos de A, de B y del hogar siguen en 0', async () => {
    await B(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'INGRESO', monto: 50_000, moneda: 'CLP', elementoDestinoId: cuentaB, fecha: '2026-03-15' })
      .expect(201);
    expect((await totales(A, 'mios')).gastos).toBe(0);
    expect((await totales(B, 'mios')).gastos).toBe(0);
    expect((await totales(A, 'hogar')).gastos).toBe(0);
    expect(await gastosPresupuesto()).toBe(0);
  });
});
