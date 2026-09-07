import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * §B3 — info adicional de Deuda/Crédito (acreedor, fechas, cuota, tasa).
 * §B2 — estado operativo derivado (VIGENTE·PARCIALMENTE_PAGADA·EN_MORA·SALDADA·…).
 */
describe('Deuda/Crédito — detalle y estado operativo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let cuentaId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  const nueva = (body: Record<string, unknown>) =>
    auth(request(http).post('/comandos/RegistrarElementoPatrimonial')).send(body);
  const get = (id: string) => auth(request(http).get(`/elementos-patrimoniales/${id}`));

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'dd@e2e.cl', nombre: 'DD', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'dd@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    cuentaId = (
      await nueva({
        nombre: 'Cuenta',
        tipo: 'cuenta_corriente',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial: 5_000_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('editar el detalle con ActualizarDatos y derivar EN_MORA', async () => {
    const id = (
      await nueva({
        nombre: 'Hipotecario',
        tipo: 'deuda',
        categoriaFuncional: 'DEUDA',
        valorPendiente: 60_000_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;

    await auth(request(http).post('/comandos/ActualizarDatosElementoPatrimonial'))
      .send({ elementoId: id, contraparte: 'Banco X', fechaTermino: '2020-01-01', cuotaMonto: 350_000 })
      .expect(200);

    const d = await get(id).expect(200);
    expect(d.body.contraparte).toBe('Banco X');
    expect(d.body.cuotaMonto).toBe(350_000);
    expect(d.body.estadoOperativo).toBe('EN_MORA');
  });

  it('pagar una parte → PARCIALMENTE_PAGADA; saldar del todo → SALDADA', async () => {
    const id = (
      await nueva({
        nombre: 'Préstamo amigo',
        tipo: 'deuda',
        categoriaFuncional: 'DEUDA',
        valorPendiente: 1_000_000,
        moneda: 'CLP',
      }).expect(201)
    ).body.id;

    const pagar = (monto: number) =>
      auth(request(http).post('/comandos/RegistrarEventoFinanciero'))
        .send({
          tipo: 'TRANSFERENCIA',
          monto,
          moneda: 'CLP',
          elementoOrigenId: cuentaId,
          elementoDestinoId: id,
        })
        .expect(201);

    await pagar(400_000);
    expect((await get(id).expect(200)).body.estadoOperativo).toBe('PARCIALMENTE_PAGADA');

    await pagar(600_000);
    const d = await get(id).expect(200);
    expect(d.body.valorPendiente).toBe(0);
    expect(d.body.estadoOperativo).toBe('SALDADA');
  });

  it('DeclararIncobrable deja el crédito en INCOBRABLE', async () => {
    const id = (
      await nueva({
        nombre: 'Me deben',
        tipo: 'credito',
        categoriaFuncional: 'CREDITO',
        valorPendiente: 200_000,
        moneda: 'CLP',
        contraparte: 'Primo',
      }).expect(201)
    ).body.id;
    expect((await get(id).expect(200)).body.estadoOperativo).toBe('VIGENTE');

    await auth(request(http).post('/comandos/DeclararIncobrable'))
      .send({ elementoId: id, motivo: 'no paga hace 2 años' })
      .expect(200);
    expect((await get(id).expect(200)).body.estadoOperativo).toBe('INCOBRABLE');
  });

  it('los campos de detalle no aplican a un elemento que no es deuda/crédito', async () => {
    const id = (
      await nueva({
        nombre: 'Ahorro',
        tipo: 'cuenta_ahorro',
        categoriaFuncional: 'LIQUIDEZ',
        valorInicial: 100,
        moneda: 'CLP',
        contraparte: 'no debería guardarse',
      }).expect(201)
    ).body.id;
    const d = await get(id).expect(200);
    expect(d.body.contraparte).toBeNull();
    expect(d.body.estadoOperativo).toBeNull();
    expect(d.body.naturaleza).toBeNull();
  });

  it('naturaleza: por defecto FINANCIERA; CUSTODIA_INFORMAL cuando se declara', async () => {
    const financiera = (
      await nueva({
        nombre: 'Crédito de consumo',
        tipo: 'credito',
        categoriaFuncional: 'DEUDA',
        valorPendiente: 2_000_000,
        moneda: 'CLP',
      }).expect(201)
    ).body;
    expect(financiera.naturaleza).toBe('FINANCIERA');

    const encargo = (
      await nueva({
        nombre: 'Encargo de Nico',
        tipo: 'encargo',
        categoriaFuncional: 'DEUDA',
        valorPendiente: 80_000,
        moneda: 'CLP',
        naturaleza: 'CUSTODIA_INFORMAL',
      }).expect(201)
    ).body;
    expect(encargo.naturaleza).toBe('CUSTODIA_INFORMAL');
    expect((await get(encargo.id).expect(200)).body.naturaleza).toBe('CUSTODIA_INFORMAL');
  });

  it('naturaleza en una categoría que no es deuda/crédito → 400', async () => {
    await nueva({
      nombre: 'Cuenta',
      tipo: 'cuenta_corriente',
      categoriaFuncional: 'LIQUIDEZ',
      valorInicial: 0,
      moneda: 'CLP',
      naturaleza: 'CUSTODIA_INFORMAL',
    }).expect(400);
  });
});
