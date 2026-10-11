import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * G45 H2 — un solo universo del hogar: "Del hogar" cuenta solo las cuentas que
 * suman al hogar (participa_consolidacion), igual que el patrimonio del hogar.
 * Una cuenta en "Nada" queda fuera; una en "Que vean el saldo" queda dentro con
 * su detalle 🔒; lo que pasa de una cuenta que no suma a una que suma es
 * "Entró al hogar" (aporte), y cuenta como ingreso del presupuesto FAMILIAR.
 */
describe('Un solo universo del hogar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA = '';
  let tokenB = '';
  let idA = '';
  let idB = '';
  let hogarId = '';
  let presupuestoId = '';
  const MES = 'desde=2026-03-01&hasta=2026-03-31';

  const reg = async (email: string, nombre: string) => {
    await request(http).post('/comandos/RegistrarUsuario').send({ email, nombre, password: 'secret123' }).expect(201);
    const login = await request(http).post('/auth/login').send({ email, password: 'secret123' });
    return { token: login.body.accessToken as string, id: login.body.usuario.id as string };
  };
  const como = (t: string) => (r: request.Test) => r.set('Authorization', `Bearer ${t}`);
  const NIVEL = {
    nada: { EXISTENCIA: 'PRIVADA', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
    saldo: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'PRIVADA' },
    todo: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'FAMILIAR' },
  };
  const cuenta = async (t: string, nombre: string, vis: (typeof NIVEL)[keyof typeof NIVEL], consolida: boolean) =>
    (
      await como(t)(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre,
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 1_000_000,
          moneda: 'CLP',
          fechaAlta: '2024-01-01',
          visibilidadPorTipo: vis,
          participaConsolidacion: consolida,
        })
        .expect(201)
    ).body.id as string;
  const evento = (t: string, body: Record<string, unknown>) =>
    como(t)(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ moneda: 'CLP', fecha: '2026-03-10', ...body })
      .expect(201);

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, elemento_visibilidad, elemento_comparticion, evento_financiero, impacto_patrimonial, categoria_movimiento, presupuesto RESTART IDENTITY CASCADE',
    );
    const a = await reg('demo@e2e.cl', 'Demo');
    const b = await reg('pareja@e2e.cl', 'Pareja');
    [tokenA, tokenB, idA, idB] = [a.token, b.token, a.id, b.id];
    hogarId = (
      await como(tokenA)(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa', monedaConsolidacion: 'CLP' }).expect(201)
    ).body.id;
    const inv = (
      await como(tokenA)(request(http).post('/comandos/InvitarMiembro')).send({ hogarId, emailInvitado: 'pareja@e2e.cl' }).expect(201)
    ).body.id;
    await como(tokenB)(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv }).expect(200);

    const hogarDemo = await cuenta(tokenA, 'Hogar de Demo', NIVEL.todo, true);
    const personalDemo = await cuenta(tokenA, 'Personal de Demo', NIVEL.nada, false);
    const comunPareja = await cuenta(tokenB, 'Común de Pareja', NIVEL.saldo, true);

    await evento(tokenA, { tipo: 'GASTO', monto: 10_000, elementoOrigenId: hogarDemo, glosa: 'Gasto del hogar' });
    await evento(tokenA, { tipo: 'GASTO', monto: 30_000, elementoOrigenId: personalDemo, glosa: 'Gasto personal' });
    await evento(tokenB, { tipo: 'GASTO', monto: 7_000, elementoOrigenId: comunPareja, glosa: 'Secreto de la común' });
    // Aporte: de la personal (no suma) a la del hogar (suma); y una salida de vuelta.
    await evento(tokenA, { tipo: 'TRANSFERENCIA', monto: 50_000, elementoOrigenId: personalDemo, elementoDestinoId: hogarDemo, glosa: 'Aporte' });
    await evento(tokenA, { tipo: 'TRANSFERENCIA', monto: 5_000, elementoOrigenId: hogarDemo, elementoDestinoId: personalDemo, glosa: 'Me devuelvo' });

    presupuestoId = (
      await como(tokenA)(request(http).post('/comandos/CrearPresupuesto'))
        .send({ tipo: 'FAMILIAR', hogarId, periodicidad: 'ESPECIFICO', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', gastosEsperados: 100_000 })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const resumen = (t: string) =>
    como(t)(request(http).get(`/usuarios/me/resumen-financiero?${MES}&alcance=hogar&hogarId=${hogarId}`)).expect(200);

  it('la cuenta en "Nada" queda fuera del mes del hogar; la de "Que vean el saldo", dentro con 🔒', async () => {
    const r = (await resumen(tokenA)).body;
    expect(r.porMoneda[0].gastos).toBe(17_000); // 10.000 del hogar + 7.000 de la común; sin los 30.000 personales
    const glosas = (r.movimientos as { glosa: string | null }[]).map((m) => m.glosa);
    expect(glosas).not.toContain('Gasto personal');
    expect(glosas).not.toContain('Secreto de la común');
    expect(r.privados).toEqual([{ usuarioId: idB, nombre: 'Pareja', moneda: 'CLP', ingresos: 0, gastos: 7_000 }]);
  });

  it('el aporte aparece como "Entró al hogar" de Demo, y la vuelta como "Salió del hogar"', async () => {
    const r = (await resumen(tokenA)).body;
    expect(r.aportes).toEqual([{ usuarioId: idA, nombre: 'Demo', moneda: 'CLP', entro: 50_000, salio: 5_000 }]);
    const aporte = (r.movimientos as { glosa: string; efectoPropio: number; ladoAfuera: { nombre: string } | null }[]).find(
      (m) => m.glosa === 'Aporte',
    )!;
    expect(aporte.efectoPropio).toBe(50_000);
    expect(aporte.ladoAfuera?.nombre).toBe('Demo');
    // Pareja ve lo mismo (los aportes no tienen detalle privado).
    expect((await resumen(tokenB)).body.aportes).toEqual(r.aportes);
  });

  it('presupuesto FAMILIAR: mismas cuentas; el aporte es ingreso y la salida no es gasto', async () => {
    const d = (await como(tokenA)(request(http).get(`/presupuestos/${presupuestoId}/desviacion`)).expect(200)).body;
    expect(d.real.gastos).toBe(17_000);
    expect(d.real.ingresos).toBe(50_000);
    expect(d.aportes).toEqual([{ usuarioId: idA, nombre: 'Demo', monto: 50_000 }]);
  });

  it('patrimonio del hogar y mes del hogar usan las mismas cuentas', async () => {
    const c = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200)).body;
    // Hogar de Demo: 1.000.000 − 10.000 + 50.000 − 5.000; Común de Pareja: 1.000.000 − 7.000. Sin la personal.
    expect(c.elementos).toBe(2);
    expect(c.total).toBe(1_035_000 + 993_000);
  });
});
