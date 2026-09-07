import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/** §B1 — visibilidad granular por tipo de información + "compartido con quién". */
describe('Visibilidad granular del elemento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let idB = '';
  let hogarId = '';
  let elementoId = '';

  const reg = async (email: string) => {
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email, nombre: email[0].toUpperCase(), password: 'secret123' })
      .expect(201);
    const login = await request(http).post('/auth/login').send({ email, password: 'secret123' });
    return { token: login.body.accessToken as string, id: login.body.usuario.id as string };
  };

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, elemento_visibilidad, elemento_comparticion, evento_financiero, impacto_patrimonial RESTART IDENTITY CASCADE',
    );
    const a = await reg('a@e2e.cl');
    const b = await reg('b@e2e.cl');
    const cc = await reg('c@e2e.cl');
    tokenA = a.token;
    tokenB = b.token;
    tokenC = cc.token;
    idB = b.id;

    hogarId = (
      await request(http)
        .post('/comandos/CrearHogar')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ nombre: 'Casa' })
        .expect(201)
    ).body.id;
    // B y C entran al hogar
    for (const [email, t] of [
      ['b@e2e.cl', tokenB],
      ['c@e2e.cl', tokenC],
    ] as const) {
      const inv = (
        await request(http)
          .post('/comandos/InvitarMiembro')
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ hogarId, emailInvitado: email })
          .expect(201)
      ).body.id;
      await request(http)
        .post('/comandos/AceptarInvitacion')
        .set('Authorization', `Bearer ${t}`)
        .send({ invitacionId: inv })
        .expect(200);
    }

    elementoId = (
      await request(http)
        .post('/comandos/RegistrarElementoPatrimonial')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          nombre: 'Cuenta de A',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 900_000,
          moneda: 'CLP',
          visibilidad: 'FAMILIAR',
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (t: string) =>
    request(http).get(`/elementos-patrimoniales/${elementoId}`).set('Authorization', `Bearer ${t}`);
  const definir = (body: Record<string, unknown>) =>
    request(http)
      .post('/comandos/DefinirVisibilidadElementoPatrimonial')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ elementoId, ...body });

  it('FAMILIAR: B ve existencia y valor', async () => {
    const r = await get(tokenB).expect(200);
    expect(r.body.valorVigente).toBe(900_000);
    expect(r.body.valorOculto).toBe(false);
  });

  it('VALOR=PRIVADA: B ve que existe pero el monto viene oculto', async () => {
    await definir({ niveles: { VALOR: 'PRIVADA' } }).expect(200);
    const r = await get(tokenB).expect(200);
    expect(r.body.valorOculto).toBe(true);
    expect(r.body.valorVigente).toBe(0);
    // el dueño sigue viendo todo
    expect((await get(tokenA).expect(200)).body.valorVigente).toBe(900_000);
  });

  it('EXISTENCIA=PRIVADA: B ya no lo encuentra', async () => {
    await definir({ niveles: { EXISTENCIA: 'PRIVADA' } }).expect(200);
    await get(tokenB).expect(404);
  });

  it('EXISTENCIA=COMPARTIDA con lista: solo B, no C', async () => {
    await definir({ niveles: { EXISTENCIA: 'COMPARTIDA', VALOR: 'COMPARTIDA' }, compartidoCon: [idB] }).expect(200);
    const r = await get(tokenB).expect(200);
    expect(r.body.valorVigente).toBe(900_000);
    await get(tokenC).expect(404);
  });

  it('MOVIMIENTOS se controla aparte del resto', async () => {
    await definir({ niveles: { MOVIMIENTOS: 'PRIVADA' } }).expect(200);
    await request(http)
      .get(`/eventos-financieros?elemento=${elementoId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    await definir({ niveles: { MOVIMIENTOS: 'FAMILIAR' } }).expect(200);
    await request(http)
      .get(`/eventos-financieros?elemento=${elementoId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
  });

  it('?alcance=hogar devuelve a B el elemento de A que puede ver', async () => {
    const r = await request(http)
      .get('/elementos-patrimoniales?alcance=hogar')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(r.body.map((e: { id: string }) => e.id)).toContain(elementoId);
    // C no está en la lista de compartición → no lo ve
    const rc = await request(http)
      .get('/elementos-patrimoniales?alcance=hogar')
      .set('Authorization', `Bearer ${tokenC}`)
      .expect(200);
    expect(rc.body.map((e: { id: string }) => e.id)).not.toContain(elementoId);
  });

  it('el historial del elemento registra el comando de visibilidad', async () => {
    const h = await request(http)
      .get(`/historial?entidadTipo=ELEMENTO_PATRIMONIAL&entidadId=${elementoId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(h.body.map((e: { comando: string }) => e.comando)).toContain(
      'DefinirVisibilidadElementoPatrimonial',
    );
  });

  it('visibilidadPorTipo en el alta: B ve la existencia (no el monto) y puede transferirle', async () => {
    // A crea una cuenta declarando EXISTENCIA visible / VALOR oculto en el propio alta.
    const cuentaA = (
      await request(http)
        .post('/comandos/RegistrarElementoPatrimonial')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          nombre: 'Cuenta sueldo de A',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 300_000,
          moneda: 'CLP',
          visibilidadPorTipo: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA' },
        })
        .expect(201)
    ).body.id;

    // B la ve en el alcance del hogar, con el monto oculto.
    const lista = await request(http)
      .get('/elementos-patrimoniales?alcance=hogar')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const vista = lista.body.find((e: { id: string }) => e.id === cuentaA);
    expect(vista).toBeTruthy();
    expect(vista.valorOculto).toBe(true);

    // B tiene su propia cuenta y puede transferirle a la de A (cierra F2 del análisis).
    const cuentaB = (
      await request(http)
        .post('/comandos/RegistrarElementoPatrimonial')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          nombre: 'Cuenta de B',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 500_000,
          moneda: 'CLP',
        })
        .expect(201)
    ).body.id;
    await request(http)
      .post('/comandos/RegistrarEventoFinanciero')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        tipo: 'TRANSFERENCIA',
        monto: 120_000,
        moneda: 'CLP',
        elementoOrigenId: cuentaB,
        elementoDestinoId: cuentaA,
        fecha: '2026-05-02',
      })
      .expect(201);
  });
});
