import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Bloque M (Docs/usabilidad/METAS_CUENTAS_S04.md) — "🏦 Esta cuenta es para
 * esta meta": progreso = apartados fijos + valor actual de sus cuentas
 * dedicadas. Repite el diagnóstico de §1 (antes: progreso congelado y libre
 * negativo) y prueba las reglas M-1 a M-7.
 */
describe('Metas con cuentas dedicadas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA = '';
  let tokenB = '';
  let hogarId = '';
  let fondo = '';
  let corriente = '';
  let casa = '';

  const reg = async (email: string, nombre: string) => {
    await request(http).post('/comandos/RegistrarUsuario').send({ email, nombre, password: 'secret123' }).expect(201);
    return (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body.accessToken as string;
  };
  const A = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
  const cmd = (nombre: string, body: Record<string, unknown>) => A(request(http).post(`/comandos/${nombre}`)).send(body);
  const meta = async (nombre: string, monto: number, extra: Record<string, unknown> = {}) =>
    (await cmd('CrearObjetivoFinanciero', { nombre, montoObjetivo: monto, moneda: 'CLP', ...extra }).expect(201)).body.id as string;
  const cuenta = async (nombre: string, categoriaFuncional: string, valorInicial: number, extra: Record<string, unknown> = {}) =>
    (
      await cmd('RegistrarElementoPatrimonial', {
        nombre,
        tipo: categoriaFuncional === 'INVERSION' ? 'fondo_mutuo' : categoriaFuncional === 'ACTIVO' ? 'inmueble' : 'cuenta_corriente',
        categoriaFuncional,
        valorInicial,
        moneda: 'CLP',
        fechaAlta: '2024-01-01',
        ...extra,
      }).expect(201)
    ).body.id as string;
  const obj = async (id: string) => (await A(request(http).get(`/objetivos-financieros/${id}`)).expect(200)).body;
  const libre = async (id: string) =>
    ((await A(request(http).get('/usuarios/me/disponibilidad')).expect(200)).body as { elementoId: string; disponible: number }[]).find(
      (x) => x.elementoId === id,
    )?.disponible;
  const valorizar = (id: string, valorNuevo: number) => cmd('RegistrarValorizacion', { elementoId: id, valorNuevo }).expect(201);

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, elemento_visibilidad, elemento_comparticion, evento_financiero, impacto_patrimonial, valorizacion, objetivo_financiero, objetivo_designado, objetivo_cuenta_dedicada, asignacion, reserva, presupuesto RESTART IDENTITY CASCADE',
    );
    tokenA = await reg('a@e2e.cl', 'Demo');
    tokenB = await reg('b@e2e.cl', 'Pareja');
    hogarId = (await cmd('CrearHogar', { nombre: 'Casa', monedaConsolidacion: 'CLP' }).expect(201)).body.id;
    const inv = (await cmd('InvitarMiembro', { hogarId, emailInvitado: 'b@e2e.cl' }).expect(201)).body.id;
    await request(http).post('/comandos/AceptarInvitacion').set('Authorization', `Bearer ${tokenB}`).send({ invitacionId: inv }).expect(200);
    fondo = await cuenta('Fondo', 'INVERSION', 1_000_000, { admiteValorizacion: true });
    corriente = await cuenta('Corriente', 'LIQUIDEZ', 500_000, { participaValorLiquido: true });
    casa = await cuenta('Casa', 'ACTIVO', 90_000_000, { admiteValorizacion: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('el progreso sigue el valor de la cuenta dedicada y lo libre nunca queda negativo', async () => {
    const m = await meta('Casa propia', 2_000_000);
    const r = (await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: fondo }).expect(200)).body;
    expect(r.progreso).toBe(1_000_000);
    expect(await libre(fondo)).toBe(0);

    await valorizar(fondo, 1_200_000);
    let o = await obj(m);
    expect(o).toMatchObject({ progreso: 1_200_000, progresoCuentas: 1_200_000, progresoApartado: 0 });
    expect(o.cuentasDedicadas).toEqual([{ elementoId: fondo, nombre: 'Fondo', valor: 1_200_000, moneda: 'CLP' }]);
    expect(await libre(fondo)).toBe(0);

    await valorizar(fondo, 800_000);
    o = await obj(m);
    expect(o.progreso).toBe(800_000);
    expect(await libre(fondo)).toBe(0); // antes: −200.000
  });

  it('una cuenta dedicada no se aparta para otra meta ni se dedica dos veces', async () => {
    const otra = await meta('Otra', 100_000);
    const r1 = await cmd('DedicarCuentaAObjetivo', { objetivoId: otra, elementoId: fondo }).expect(409);
    expect(r1.body.codigo).toBe('CUENTA_DEDICADA_A_OTRA_META');
    const a = (await cmd('CrearAsignacion', { nombre: 'Otra', objetivoId: otra }).expect(201)).body.id;
    const r2 = await cmd('CrearReserva', { asignacionId: a, elementoOrigenId: fondo, monto: 1 }).expect(409);
    expect(r2.body.codigo).toBe('CUENTA_DEDICADA');
  });

  it('no se dedican bienes (M-5)', async () => {
    const m = await meta('Cambiar de casa', 100_000_000);
    const r = await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: casa }).expect(409);
    expect(r.body.codigo).toBe('CUENTA_NO_DEDICABLE');
  });

  it('la meta se completa cuando la cuenta dedicada sube de valor', async () => {
    const m = await meta('Auto', 900_000);
    const c = await cuenta('Ahorro auto', 'INVERSION', 850_000, { admiteValorizacion: true });
    await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: c }).expect(200);
    expect((await obj(m)).estado).toBe('EN_PROGRESO');
    await valorizar(c, 910_000);
    expect((await obj(m)).estado).toBe('COMPLETADO');
  });

  it('§2.3: lo apartado "cuenta completa" se sugiere y, al dedicar, sus reservas se liberan sin bajar el progreso', async () => {
    const m = await meta('Viaje', 1_000_000);
    const c = await cuenta('Cuenta viaje', 'RESERVA', 300_000);
    await cmd('AhorrarParaObjetivo', { objetivoId: m, destinoId: c, origenes: [{ elementoId: c, monto: 300_000 }] }).expect(201);
    let o = await obj(m);
    expect(o.sugerenciasCuentaCompleta).toEqual([{ elementoId: c, nombre: 'Cuenta viaje' }]);
    const r = (await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: c }).expect(200)).body;
    expect(r.reservasLiberadas).toHaveLength(1);
    o = await obj(m);
    expect(o).toMatchObject({ progreso: 300_000, progresoApartado: 0, progresoCuentas: 300_000, sugerenciasCuentaCompleta: [] });

    // Ahorrar hacia la cuenta dedicada: solo transfiere; el valor de la cuenta ya cuenta.
    const ah = (
      await cmd('AhorrarParaObjetivo', { objetivoId: m, destinoId: c, origenes: [{ elementoId: corriente, monto: 50_000 }] }).expect(201)
    ).body;
    expect(ah.reservaId).toBeNull();
    expect((await obj(m)).progreso).toBe(350_000);
  });

  it('quitar una cuenta exige decidir si se conserva como apartado (sin opción por defecto)', async () => {
    const m = await meta('Bici', 500_000);
    const c = await cuenta('Cuenta bici', 'RESERVA', 120_000);
    await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: c }).expect(200);
    await cmd('QuitarCuentaDeObjetivo', { objetivoId: m, elementoId: c }).expect(400);
    const r = (await cmd('QuitarCuentaDeObjetivo', { objetivoId: m, elementoId: c, conservarComoApartado: true }).expect(200)).body;
    expect(r.reservaId).toBeTruthy();
    expect((await obj(m))).toMatchObject({ progreso: 120_000, progresoApartado: 120_000, progresoCuentas: 0 });

    const m2 = await meta('Bici 2', 500_000);
    const c2 = await cuenta('Cuenta bici 2', 'RESERVA', 70_000);
    await cmd('DedicarCuentaAObjetivo', { objetivoId: m2, elementoId: c2 }).expect(200);
    await cmd('QuitarCuentaDeObjetivo', { objetivoId: m2, elementoId: c2, conservarComoApartado: false }).expect(200);
    expect((await obj(m2)).progreso).toBe(0);
    expect(await libre(c2)).toBe(70_000);
  });

  it('meta del hogar: solo una cuenta cuyo saldo vea el hogar (M-7)', async () => {
    const m = await meta('Vacaciones', 2_000_000, { hogarId });
    const privada = await cuenta('Privada', 'RESERVA', 100_000, {
      visibilidadPorTipo: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
    });
    const r = await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: privada }).expect(409);
    expect(r.body.codigo).toBe('CUENTA_SALDO_PRIVADO');
    const visible = await cuenta('Visible', 'RESERVA', 100_000, {
      visibilidadPorTipo: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'PRIVADA' },
    });
    await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: visible }).expect(200);
  });

  it('presupuesto: el ahorro real es lo transferido a la cuenta dedicada, neto de retiros; la valorización no cuenta', async () => {
    const m = await meta('Fondo de estudio', 5_000_000);
    const c = await cuenta('Estudio', 'INVERSION', 0, { admiteValorizacion: true });
    await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: c }).expect(200);
    const p = (
      await cmd('CrearPresupuesto', { tipo: 'INDIVIDUAL', periodicidad: 'ESPECIFICO', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', gastosEsperados: 1 }).expect(201)
    ).body.id;
    await cmd('DefinirLineasAhorroPresupuesto', { presupuestoId: p, lineas: [{ objetivoId: m, montoEsperado: 100_000 }] }).expect(200);
    await cmd('RegistrarEventoFinanciero', {
      tipo: 'TRANSFERENCIA', monto: 80_000, moneda: 'CLP', fecha: '2026-03-05', elementoOrigenId: corriente, elementoDestinoId: c,
    }).expect(201);
    await cmd('RegistrarEventoFinanciero', {
      tipo: 'TRANSFERENCIA', monto: 10_000, moneda: 'CLP', fecha: '2026-03-20', elementoOrigenId: c, elementoDestinoId: corriente,
    }).expect(201);
    await cmd('RegistrarValorizacion', { elementoId: c, valorNuevo: 95_000, fecha: '2026-03-25' }).expect(201);
    const d = (await A(request(http).get(`/presupuestos/${p}/desviacion`)).expect(200)).body;
    expect(d.porObjetivo.find((x: { objetivoId: string }) => x.objetivoId === m).real).toBe(70_000);
  });

  it('patrimonio: la cuenta dedicada va en "Guardado para metas" y no en lo libre', async () => {
    const antes = (await A(request(http).get('/usuarios/me/patrimonio-individual')).expect(200)).body.porMoneda[0];
    const m = await meta('Emergencia', 10_000_000);
    const c = await cuenta('Emergencia', 'LIQUIDEZ', 40_000, { participaValorLiquido: true });
    const conCuenta = (await A(request(http).get('/usuarios/me/patrimonio-individual')).expect(200)).body.porMoneda[0];
    await cmd('DedicarCuentaAObjetivo', { objetivoId: m, elementoId: c }).expect(200);
    const despues = (await A(request(http).get('/usuarios/me/patrimonio-individual')).expect(200)).body.porMoneda[0];
    expect(conCuenta.valorLibre - antes.valorLibre).toBe(40_000);
    expect(despues.valorLibre).toBe(antes.valorLibre);
    expect(despues.reservadoEnLiquidez - conCuenta.reservadoEnLiquidez).toBe(40_000);
  });
});
