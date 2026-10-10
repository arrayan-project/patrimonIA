import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * G41/G42 — la foto del mes de las cuentas del día a día: lo que había al
 * empezar, qué la movió y lo que hay al terminar, cuadrando. El mes va del 25
 * de septiembre al 24 de octubre (G43: el ciclo lo arma la app).
 */
describe('Foto del mes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let chile: string;
  let tarjeta: string;
  let bci: string;
  let fondo: string;
  let ahorro: string;
  let hogarId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const ev = (body: object) =>
    auth(request(http).post('/comandos/RegistrarEventoFinanciero')).send({ moneda: 'CLP', ...body }).expect(201);
  const mover = (origen: string, destino: string, monto: number, fecha: string) =>
    ev({ tipo: 'TRANSFERENCIA', monto, elementoOrigenId: origen, elementoDestinoId: destino, fecha });
  const ventana = 'desde=2026-09-25&hasta=2026-10-24';

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, categoria_movimiento, evento_etiqueta, etiqueta, objetivo_financiero, asignacion, reserva, notificacion RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'foto@e2e.cl', nombre: 'Foto', password: 'secret123' })
      .expect(201);
    token = (await request(http).post('/auth/login').send({ email: 'foto@e2e.cl', password: 'secret123' })).body
      .accessToken;
    hogarId = (await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)).body.id;
    const el = async (body: object) =>
      (
        await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({ tipo: 'x', moneda: 'CLP', fechaAlta: '2024-01-01', ...body })
          .expect(201)
      ).body.id as string;
    chile = await el({ nombre: 'Banco de Chile', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1_000_000 });
    tarjeta = await el({ nombre: 'Tarjeta', categoriaFuncional: 'DEUDA', valorPendiente: 80_000 });
    bci = await el({ nombre: 'BCI', categoriaFuncional: 'LIQUIDEZ', valorInicial: 3_000_000 });
    fondo = await el({ nombre: 'Fondo', categoriaFuncional: 'INVERSION', valorInicial: 500_000 });
    ahorro = await el({ nombre: 'Ahorro', categoriaFuncional: 'RESERVA', valorInicial: 0 });

    await ev({ tipo: 'GASTO', monto: 100_000, elementoOrigenId: chile, fecha: '2026-09-20' }); // antes del mes
    await ev({ tipo: 'INGRESO', monto: 2_000_000, elementoDestinoId: chile, fecha: '2026-09-25' });
    await ev({ tipo: 'GASTO', monto: 50_000, elementoOrigenId: tarjeta, fecha: '2026-09-27' });
    await mover(chile, tarjeta, 130_000, '2026-10-05'); // pagar la tarjeta: entre cuentas del grupo
    await mover(chile, bci, 300_000, '2026-10-06');
    await mover(chile, fondo, 200_000, '2026-10-07');
    await mover(chile, ahorro, 150_000, '2026-10-08');
    await mover(bci, chile, 100_000, '2026-10-09');
    await ev({ tipo: 'GASTO', monto: 7_000, elementoOrigenId: chile, fecha: '2026-10-30' }); // después del mes
  });

  afterAll(async () => {
    await app.close();
  });

  it('cuadra: tenías + lo que entró y salió = tienes, y pagar la tarjeta no cuenta dos veces', async () => {
    const r = await auth(request(http).get(`/usuarios/me/foto-mes?${ventana}&cuentas=${chile},${tarjeta}`)).expect(200);
    expect(r.body.cuentas.sort()).toEqual([chile, tarjeta].sort());
    const clp = r.body.porMoneda[0];
    expect(clp.moneda).toBe('CLP');
    expect(clp.tenias).toBe(1_000_000 - 100_000 - 80_000);
    const por = (clase: string, signo: 1 | -1) =>
      clp.lineas.find((l: { clase: string; monto: number }) => l.clase === clase && Math.sign(l.monto) === signo)?.monto;
    expect(por('INGRESO', 1)).toBe(2_000_000);
    expect(por('GASTO', -1)).toBe(-50_000);
    expect(por('OTRAS', -1)).toBe(-300_000);
    expect(por('OTRAS', 1)).toBe(100_000);
    expect(por('INVERSION', -1)).toBe(-200_000);
    expect(por('AHORRO', -1)).toBe(-150_000);
    expect(clp.lineas.some((l: { clase: string }) => l.clase === 'DEUDA')).toBe(false);
    const suma = clp.lineas.reduce((s: number, l: { monto: number }) => s + l.monto, 0);
    expect(clp.tienes).toBe(clp.tenias + suma);
    expect(clp.tienes).toBe(820_000 + 2_000_000 - 50_000 - 300_000 - 200_000 - 150_000 + 100_000);
  });

  it('sin la tarjeta en el grupo, pagarla es "pagaste deudas" y la compra con tarjeta no aparece', async () => {
    const r = await auth(request(http).get(`/usuarios/me/foto-mes?${ventana}&cuentas=${chile}`)).expect(200);
    const clp = r.body.porMoneda[0];
    expect(clp.lineas.find((l: { clase: string }) => l.clase === 'DEUDA').monto).toBe(-130_000);
    expect(clp.lineas.some((l: { clase: string }) => l.clase === 'GASTO')).toBe(false);
    const suma = clp.lineas.reduce((s: number, l: { monto: number }) => s + l.monto, 0);
    expect(clp.tienes).toBe(clp.tenias + suma);
  });

  it('el resumen del período con las mismas cuentas da lo mismo, y lo movido a otra cuenta tuya no es de otra persona', async () => {
    const r = await auth(
      request(http).get(`/usuarios/me/resumen-financiero?${ventana}&alcance=mios&cuentas=${chile},${tarjeta}`),
    ).expect(200);
    expect(r.body.porMoneda[0]).toMatchObject({ ingresos: 2_000_000, gastos: 50_000 });
    expect(r.body.movimientos.every((m: { contraparte: unknown }) => m.contraparte === null)).toBe(true);
    const aBci = r.body.movimientos.find((m: { elementoDestinoId: string }) => m.elementoDestinoId === bci);
    expect(aBci.efectoPropio).toBe(-300_000);
  });

  it('ignora las cuentas que no son tuyas', async () => {
    const r = await auth(
      request(http).get(`/usuarios/me/foto-mes?${ventana}&cuentas=00000000-0000-0000-0000-000000000000`),
    ).expect(200);
    expect(r.body).toMatchObject({ cuentas: [], porMoneda: [] });
  });

  it('G43: el hogar guarda el día en que parte su mes (1–28)', async () => {
    const cambiar = (dia: number) => auth(request(http).post('/comandos/CambiarInicioMesHogar')).send({ hogarId, dia });
    expect((await auth(request(http).get('/usuarios/me/hogares')).expect(200)).body[0].diaInicioMes).toBe(1);
    expect((await cambiar(25).expect(200)).body.diaInicioMes).toBe(25);
    await cambiar(25).expect(409);
    await cambiar(29).expect(400);
  });
});
