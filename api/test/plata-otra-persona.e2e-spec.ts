import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * G33 D-3 / D-8 — RegistrarPlataDeOtraPersona (M8, M10; HZ-11, HZ-18, HZ-20):
 * la plata de una persona mueve el saldo con ella (DEUDA o CREDITO
 * CUSTODIA_INFORMAL que nace con pendiente 0), cruza de signo en la misma
 * transacción y no cuenta como libre para gastar.
 */
describe('Plata de otra persona (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let corriente: string;
  let dolares: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const valor = async (id: string) =>
    (await auth(request(http).get(`/elementos-patrimoniales/${id}`)).expect(200)).body.valorVigente as number;
  const registrar = (body: object) =>
    auth(request(http).post('/comandos/RegistrarPlataDeOtraPersona')).send(body);
  const personas = async (todas = false) =>
    (await auth(request(http).get(`/usuarios/me/personas${todas ? '?todas=true' : ''}`)).expect(200))
      .body as { persona: string; saldo: number; deudaId: string | null; creditoId: string | null }[];
  const libre = async () =>
    (await auth(request(http).get('/usuarios/me/patrimonio-individual')).expect(200)).body.porMoneda.find(
      (m: { moneda: string }) => m.moneda === 'CLP',
    ) as { valorLiquido: number; valorReservado: number; plataAjena: number; valorLibre: number; patrimonio: number };
  const ingreso = async (monto: number) =>
    (
      await auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({ tipo: 'INGRESO', monto, moneda: 'CLP', elementoDestinoId: corriente, glosa: 'Encargo' })
        .expect(201)
    ).body.id as string;

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, notificacion RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'persona@e2e.cl', nombre: 'P', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'persona@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    const el = async (nombre: string, moneda: string, extra: object = {}) =>
      (
        await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({
            nombre,
            tipo: 'x',
            categoriaFuncional: 'LIQUIDEZ',
            valorInicial: 500_000,
            moneda,
            participaValorLiquido: true,
            ...extra,
          })
          .expect(201)
      ).body.id as string;
    corriente = await el('Corriente', 'CLP', { participaConsolidacion: true });
    dolares = await el('Dólares', 'USD');
  });

  afterAll(async () => {
    await app.close();
  });

  it('M10: pagar por una persona nueva abre un crédito con pendiente 0 y auditoría encadenada', async () => {
    const r = (
      await registrar({ direccion: 'SALE', cuentaId: corriente, monto: 30_000, persona: 'Noira' }).expect(201)
    ).body;
    expect(r).toMatchObject({ persona: 'Noira', moneda: 'CLP', saldo: 30_000, deudaId: null, anuladoId: null });
    expect(r.eventoIds).toHaveLength(1);
    expect(await valor(corriente)).toBe(470_000);

    const credito = await prisma.elemento_patrimonial.findUniqueOrThrow({ where: { id: r.creditoId } });
    expect(credito).toMatchObject({
      categoria_funcional: 'CREDITO',
      naturaleza: 'CUSTODIA_INFORMAL',
      contraparte: 'Noira',
      // Hereda de la cuenta si suma al hogar (decisión 3 del plan del bloque 8).
      participa_consolidacion: true,
    });
    expect(Number(credito.valor_pendiente_inicial)).toBe(0);
    expect(Number(credito.valor_pendiente)).toBe(30_000);

    const raiz = await prisma.auditoria.findFirstOrThrow({ where: { comando: 'RegistrarPlataDeOtraPersona' } });
    const hijas = await prisma.auditoria.findMany({ where: { encadenada_de_id: raiz.id } });
    expect(hijas.map((h) => h.comando).sort()).toEqual(['RegistrarElementoPatrimonial', 'RegistrarEventoFinanciero']);
  });

  it('M8 y borde de D-3: si entra más de lo que te debía, el crédito queda en 0 y lo demás es deuda', async () => {
    const r = (
      await registrar({ direccion: 'ENTRA', cuentaId: corriente, monto: 50_000, persona: '  noira ' }).expect(201)
    ).body;
    expect(r.saldo).toBe(-20_000);
    expect(r.eventoIds).toHaveLength(2);
    expect(await valor(corriente)).toBe(520_000);
    expect(await valor(r.creditoId)).toBe(0);
    expect(await valor(r.deudaId)).toBe(-20_000);

    // El crédito en 0 no se desactiva: se reúsa.
    const credito = await prisma.elemento_patrimonial.findUniqueOrThrow({ where: { id: r.creditoId } });
    expect(credito.estado).toBe('ACTIVO');
    expect(await personas()).toEqual([
      { persona: 'Noira', moneda: 'CLP', saldo: -20_000, deudaId: r.deudaId, creditoId: r.creditoId },
    ]);
  });

  it('HZ-18: lo que debes de otra persona no es libre para gastar', async () => {
    const l = await libre();
    expect(l.plataAjena).toBe(20_000);
    expect(l.valorLibre).toBe(l.valorLiquido - l.valorReservado - 20_000);
  });

  it('quedar a mano oculta a la persona, salvo con ?todas=true', async () => {
    const r = (
      await registrar({ direccion: 'SALE', cuentaId: corriente, monto: 20_000, persona: 'Noira' }).expect(201)
    ).body;
    expect(r.saldo).toBe(0);
    expect(r.eventoIds).toHaveLength(1);
    expect(await personas()).toEqual([]);
    expect((await personas(true)).map((p) => p.persona)).toEqual(['Noira']);
    expect((await libre()).plataAjena).toBe(0);
  });

  it('HZ-20 "Sí, la anoté como mía": anula el ingreso y lo registra como plata de la persona', async () => {
    const ingresoId = await ingreso(40_000);
    expect(await valor(corriente)).toBe(540_000);

    const r = (
      await registrar({
        direccion: 'SALE',
        cuentaId: corriente,
        monto: 40_000,
        persona: 'Rosa',
        anularIngresoId: ingresoId,
      }).expect(201)
    ).body;
    expect(r).toMatchObject({ persona: 'Rosa', saldo: 0, anuladoId: ingresoId });
    expect(r.eventoIds).toHaveLength(2);
    expect(await valor(corriente)).toBe(500_000);
    const anulado = await prisma.evento_financiero.findUniqueOrThrow({ where: { id: ingresoId } });
    expect(anulado.anulado).toBe(true);

    const raiz = await prisma.auditoria.findFirstOrThrow({
      where: { comando: 'RegistrarPlataDeOtraPersona', entidad_id: corriente },
      orderBy: { fecha_hora: 'desc' },
    });
    const hijas = await prisma.auditoria.findMany({ where: { encadenada_de_id: raiz.id } });
    expect(hijas.map((h) => h.comando)).toContain('AnularEventoFinanciero');
  });

  it('HZ-20 "No la anoté": registra la entrada y la salida', async () => {
    const r = (
      await registrar({
        direccion: 'SALE',
        cuentaId: corriente,
        monto: 10_000,
        persona: 'Luis',
        registrarEntrada: true,
      }).expect(201)
    ).body;
    expect(r.saldo).toBe(0);
    expect(r.eventoIds).toHaveLength(2);
    expect(await valor(corriente)).toBe(500_000);
  });

  it('si algo falla, no queda nada a medias', async () => {
    const ingresoId = await ingreso(5_000);
    await auth(request(http).post('/comandos/CorregirEventoFinanciero'))
      .send({ eventoId: ingresoId, nuevoMonto: 6_000, motivo: 'Corrección' })
      .expect(201);
    const antes = await valor(corriente);

    // El ingreso tiene una corrección viva: la anulación falla dentro de la transacción.
    await registrar({
      direccion: 'SALE',
      cuentaId: corriente,
      monto: 6_000,
      persona: 'Ana',
      anularIngresoId: ingresoId,
    }).expect(409);
    expect(await valor(corriente)).toBe(antes);
    expect(await prisma.elemento_patrimonial.count({ where: { contraparte: 'Ana' } })).toBe(0);
  });

  it('valida la entrada', async () => {
    const r1 = await registrar({
      direccion: 'ENTRA',
      cuentaId: corriente,
      monto: 1,
      persona: 'Noira',
      registrarEntrada: true,
    }).expect(400);
    expect(r1.body.codigo).toBe('PREVIO_NO_VALIDO');

    const noira = (await personas(true)).find((p) => p.persona === 'Noira')!;
    const r2 = await registrar({
      direccion: 'SALE',
      cuentaId: noira.creditoId,
      monto: 1,
      persona: 'Rosa',
    }).expect(400);
    expect(r2.body.codigo).toBe('CUENTA_NO_VALIDA');

    const ingresoId = await ingreso(1_000);
    const r3 = await registrar({
      direccion: 'SALE',
      cuentaId: dolares,
      monto: 1,
      persona: 'Rosa',
      anularIngresoId: ingresoId,
    }).expect(400);
    expect(r3.body.codigo).toBe('MONEDA_DISTINTA');
  });

  it('el saldo con una persona es por moneda', async () => {
    const r = (
      await registrar({ direccion: 'ENTRA', cuentaId: dolares, monto: 100, persona: 'Noira' }).expect(201)
    ).body;
    expect(r).toMatchObject({ moneda: 'USD', saldo: -100 });
    expect((await personas()).map((p) => [p.persona, p.saldo])).toEqual([['Noira', -100]]);
  });
});
