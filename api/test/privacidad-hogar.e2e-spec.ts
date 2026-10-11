import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * H1 (GAPS.md G45) — privacidad de los movimientos en "Del hogar": el detalle
 * (glosa, categoría, fila) de una cuenta cuyos MOVIMIENTOS el actor no puede
 * ver (§B1) no se devuelve; su monto va en una línea por dueño
 * ("🔒 Movimientos privados de [nombre]"). Los totales no cambian.
 */
describe('Privacidad de movimientos en "Del hogar" (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA = '';
  let tokenB = '';
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
  // Los 4 niveles de "¿Qué compartes?" (app/src/compartirHogar.ts).
  const NIVEL = {
    transferir: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
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
  const gasto = (t: string, elementoOrigenId: string, monto: number, glosa: string, categoriaId?: string) =>
    como(t)(request(http).post('/comandos/RegistrarEventoFinanciero'))
      .send({ tipo: 'GASTO', monto, moneda: 'CLP', elementoOrigenId, fecha: '2026-03-10', glosa, ...(categoriaId ? { categoriaId } : {}) })
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
    tokenA = a.token;
    tokenB = b.token;
    idB = b.id;
    hogarId = (await como(tokenA)(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)).body.id;
    const inv = (
      await como(tokenA)(request(http).post('/comandos/InvitarMiembro')).send({ hogarId, emailInvitado: 'pareja@e2e.cl' }).expect(201)
    ).body.id;
    await como(tokenB)(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv }).expect(200);

    const cats = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/categorias-movimiento`)).expect(200)).body as {
      id: string;
      nombre: string;
    }[];
    const mercado = cats.find((c) => c.nombre === 'Mercado')!.id;

    const deDemo = await cuenta(tokenA, 'Cuenta de Demo', NIVEL.todo, true);
    const sueldoB = await cuenta(tokenB, 'Sueldo de Pareja', NIVEL.transferir, false);
    const comunB = await cuenta(tokenB, 'Común de Pareja', NIVEL.saldo, true);
    const visibleB = await cuenta(tokenB, 'Visible de Pareja', NIVEL.todo, true);

    await gasto(tokenA, deDemo, 10_000, 'Gasto de Demo');
    await gasto(tokenB, sueldoB, 40_000, 'Secreto del sueldo', mercado);
    await gasto(tokenB, comunB, 7_000, 'Secreto de la común');
    await gasto(tokenB, visibleB, 5_000, 'Público de Pareja');

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

  it('resumen del mes: Demo no ve el detalle de lo privado de Pareja, sí la línea 🔒 con su monto', async () => {
    const r = (await resumen(tokenA)).body;
    const glosas = (r.movimientos as { glosa: string | null }[]).map((m) => m.glosa);
    expect(glosas).toContain('Gasto de Demo');
    expect(glosas).toContain('Público de Pareja');
    expect(glosas).not.toContain('Secreto del sueldo');
    expect(glosas).not.toContain('Secreto de la común');
    // G45 H2: el sueldo de Pareja no suma al hogar (no entra); la común suma con movimientos privados (🔒).
    expect(r.privados).toEqual([{ usuarioId: idB, nombre: 'Pareja', moneda: 'CLP', ingresos: 0, gastos: 7_000 }]);
    // La categoría del gasto privado tampoco aparece como rubro.
    expect((r.porRubro as { nombre: string }[]).map((x) => x.nombre)).not.toContain('Mercado');
  });

  it('los totales son los mismos: Demo (con 🔒) y Pareja (que ve todo) suman igual', async () => {
    const a = (await resumen(tokenA)).body;
    const b = (await resumen(tokenB)).body;
    expect(b.privados).toEqual([]);
    expect(a.porMoneda).toEqual(b.porMoneda);
    expect(a.porMoneda[0].gastos).toBe(22_000);
    // Lo desglosado + lo privado cuadra con el total.
    const rubros = (a.porRubro as { tipo: string; total: number }[]).filter((x) => x.tipo === 'GASTO').reduce((s, x) => s + x.total, 0);
    expect(rubros + a.privados[0].gastos).toBe(a.porMoneda[0].gastos);
  });

  it('presupuesto FAMILIAR: el real no cambia; lo privado no se desglosa por rubro', async () => {
    const a = (await como(tokenA)(request(http).get(`/presupuestos/${presupuestoId}/desviacion`)).expect(200)).body;
    const b = (await como(tokenB)(request(http).get(`/presupuestos/${presupuestoId}/desviacion`)).expect(200)).body;
    expect(a.real.gastos).toBe(22_000);
    expect(b.real).toEqual(a.real);
    expect(a.privados).toEqual([{ usuarioId: idB, nombre: 'Pareja', ingresos: 0, gastos: 7_000 }]);
    expect(b.privados).toEqual([]);
    expect(a.sinClasificar.gastos).toBe(15_000); // Demo 10.000 + Público 5.000
    // Mercado (gasto del sueldo, que no suma al hogar) no aparece como rubro para nadie (G45 H2).
    expect((a.porRubro as { nombre: string }[]).map((x) => x.nombre)).not.toContain('Mercado');
    expect((b.porRubro as { nombre: string }[]).map((x) => x.nombre)).not.toContain('Mercado');
  });

  it('eventos del hogar: sin los de la cuenta que suma pero tiene los movimientos privados', async () => {
    const evs = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/eventos-financieros`)).expect(200)).body as {
      glosa: string | null;
    }[];
    const glosas = evs.map((e) => e.glosa);
    expect(glosas).toContain('Público de Pareja');
    expect(glosas).not.toContain('Secreto de la común');
    expect(glosas).not.toContain('Secreto del sueldo');
  });
});
