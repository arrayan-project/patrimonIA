import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * Bloque S (G45) — las preguntas de "compartir" (app/src/compartirPreguntas.ts)
 * se guardan en los campos de siempre. Equivalencias con los 4 niveles de D-2,
 * vistas desde el otro miembro (A) para la cuenta de B:
 *   Nada                      = 🏠 No                → A no la ve, no suma, no puede transferirle
 *   Que puedan transferirte   = 🏠 No · 🔁 Sí         → A la ve sin saldo y puede transferirle; no suma
 *   Que vean el saldo y sume  = 🏠 Sí · 👀 No         → A ve el saldo, no los movimientos; suma
 *   Todo                      = 🏠 Sí · 👀 Sí         → A ve saldo y movimientos; suma
 */
describe('Compartir en preguntas: las 4 equivalencias (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA = '';
  let tokenB = '';
  let hogarId = '';
  let cuentaA = '';
  let cuentaB = '';
  let consolidaB = false;

  const reg = async (email: string, nombre: string) => {
    await request(http).post('/comandos/RegistrarUsuario').send({ email, nombre, password: 'secret123' }).expect(201);
    return (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body.accessToken as string;
  };
  const como = (t: string) => (r: request.Test) => r.set('Authorization', `Bearer ${t}`);

  // Lo que guarda la app para cada respuesta (guardadoDe en compartirPreguntas.ts).
  const guardar = async (r: { hogar: boolean; movimientos: boolean; transferir: boolean }) => {
    const niveles = r.hogar
      ? { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: r.movimientos ? 'FAMILIAR' : 'PRIVADA' }
      : { EXISTENCIA: r.transferir ? 'FAMILIAR' : 'PRIVADA', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' };
    await como(tokenB)(request(http).post('/comandos/DefinirVisibilidadElementoPatrimonial'))
      .send({ elementoId: cuentaB, niveles, compartidoCon: [] })
      .expect(200);
    // Como aplicarRespuestas: solo si cambia.
    if (r.hogar !== consolidaB) {
      await como(tokenB)(request(http).post('/comandos/CambiarParticipacionEnConsolidacion'))
        .send({ elementoId: cuentaB, participa: r.hogar })
        .expect(200);
      consolidaB = r.hogar;
    }
  };

  // Lo que A ve de la cuenta de B.
  const loQueVeA = async () => {
    const delHogar = (await como(tokenA)(request(http).get('/elementos-patrimoniales?alcance=hogar')).expect(200)).body as {
      id: string;
      valorOculto?: boolean;
    }[];
    const laVe = delHogar.find((e) => e.id === cuentaB);
    const movs = await como(tokenA)(request(http).get(`/eventos-financieros?elemento=${cuentaB}`));
    const transferir = await como(tokenA)(request(http).post('/comandos/RegistrarEventoFinanciero')).send({
      tipo: 'TRANSFERENCIA',
      monto: 1,
      moneda: 'CLP',
      elementoOrigenId: cuentaA,
      elementoDestinoId: cuentaB,
      fecha: '2026-03-10',
    });
    return {
      ve: !!laVe,
      veSaldo: !!laVe && !laVe.valorOculto,
      veMovimientos: movs.status === 200,
      puedeTransferir: transferir.status === 201,
    };
  };

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableShutdownHooks();
    await app.init();
    prisma = app.get(PrismaService);
    http = app.getHttpServer();
    await prisma.$executeRawUnsafe(
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, elemento_visibilidad, elemento_comparticion, evento_financiero, impacto_patrimonial RESTART IDENTITY CASCADE',
    );
    tokenA = await reg('a@e2e.cl', 'Demo');
    tokenB = await reg('b@e2e.cl', 'Pareja');
    hogarId = (
      await como(tokenA)(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa', monedaConsolidacion: 'CLP' }).expect(201)
    ).body.id;
    const inv = (
      await como(tokenA)(request(http).post('/comandos/InvitarMiembro')).send({ hogarId, emailInvitado: 'b@e2e.cl' }).expect(201)
    ).body.id;
    await como(tokenB)(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv }).expect(200);
    const alta = (t: string, nombre: string, valorInicial: number, consolida: boolean) =>
      como(t)(request(http).post('/comandos/RegistrarElementoPatrimonial')).send({
        nombre,
        tipo: 'cuenta_corriente',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial,
        moneda: 'CLP',
        fechaAlta: '2024-01-01',
        participaConsolidacion: consolida,
        visibilidadPorTipo: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'FAMILIAR' },
      });
    cuentaA = (await alta(tokenA, 'Cuenta de Demo', 1_000_000, true).expect(201)).body.id;
    cuentaB = (await alta(tokenB, 'Cuenta de Pareja', 500_000, false).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Nada = 🏠 No: A no la ve, no suma y no puede transferirle', async () => {
    await guardar({ hogar: false, movimientos: false, transferir: false });
    const v = await loQueVeA();
    expect(v).toMatchObject({ ve: false, veSaldo: false, veMovimientos: false, puedeTransferir: false });
    const cons = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200)).body;
    expect(cons.elementos).toBe(1);
  });

  it('Que puedan transferirte = 🏠 No · 🔁 Sí: A la ve sin saldo y puede transferirle; no suma', async () => {
    await guardar({ hogar: false, movimientos: false, transferir: true });
    const v = await loQueVeA();
    expect(v).toMatchObject({ ve: true, veSaldo: false, veMovimientos: false, puedeTransferir: true });
    const cons = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200)).body;
    expect(cons.elementos).toBe(1);
  });

  it('Que vean el saldo y sume = 🏠 Sí · 👀 No: A ve el saldo, no los movimientos; suma', async () => {
    await guardar({ hogar: true, movimientos: false, transferir: false });
    const v = await loQueVeA();
    expect(v).toMatchObject({ ve: true, veSaldo: true, veMovimientos: false, puedeTransferir: true });
    const cons = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200)).body;
    expect(cons.elementos).toBe(2);
  });

  it('Todo = 🏠 Sí · 👀 Sí: A ve saldo y movimientos; suma', async () => {
    await guardar({ hogar: true, movimientos: true, transferir: false });
    const v = await loQueVeA();
    expect(v).toMatchObject({ ve: true, veSaldo: true, veMovimientos: true, puedeTransferir: true });
    const cons = (await como(tokenA)(request(http).get(`/hogares/${hogarId}/patrimonio-consolidado`)).expect(200)).body;
    expect(cons.elementos).toBe(2);
  });
});
