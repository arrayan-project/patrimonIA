import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

/**
 * G33 bloque 9 — D-7 (M7) y "Avisarle a [miembro]": A pagó algo de los dos y le
 * pide su parte a B; B la paga con una TRANSFERENCIA normal o dice "No me
 * corresponde". El estado se deriva de los eventos: anular el pago la deja
 * pendiente de nuevo; anular el gasto la anula.
 */
describe('Solicitudes de transferencia entre miembros (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let idB: string;
  let idC: string;
  let cuentaA: string;
  let cuentaB: string;
  let privadaA: string;

  const A = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
  const B = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);
  const valor = async (id: string, quien = A) =>
    (await quien(request(http).get(`/elementos-patrimoniales/${id}`)).expect(200)).body.valorVigente as number;
  const lista = async (quien: typeof A) =>
    (await quien(request(http).get('/usuarios/me/solicitudes')).expect(200)).body as Array<{
      id: string;
      estado: string;
      direccion: string;
      motivo: string;
      monto: number;
      totalGasto: number | null;
      glosa: string | null;
      cuentaDisponible: boolean;
      eventoGastoId: string | null;
      eventoPagoId: string | null;
    }>;
  const solicitud = async (quien: typeof A, id: string) => (await lista(quien)).find((s) => s.id === id)!;
  const avisos = async (quien: typeof A, tipo: string) =>
    ((await quien(request(http).get('/usuarios/me/notificaciones')).expect(200)).body as Array<{ tipo: string; titulo: string; entidadId: string }>)
      .filter((n) => n.tipo === tipo);
  const compartir = (body: object) => A(request(http).post('/comandos/RegistrarGastoCompartido')).send(body);
  const gasto = (parte: number, extra: object = {}) => ({
    monto: 60_000,
    moneda: 'CLP',
    fecha: '2026-03-20',
    elementoOrigenId: cuentaA,
    glosa: 'Supermercado',
    partes: [{ usuarioId: idB, monto: parte }],
    cuentaDestinoId: cuentaA,
    ...extra,
  });
  const pagar = (solicitudId: string, quien = B) =>
    quien(request(http).post('/comandos/PagarSolicitud')).send({ solicitudId, elementoOrigenId: cuentaB });

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
      'TRUNCATE solicitud_transferencia, auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, notificacion RESTART IDENTITY CASCADE',
    );
    const reg = async (email: string, nombre: string) => {
      await request(http).post('/comandos/RegistrarUsuario').send({ email, nombre, password: 'secret123' }).expect(201);
      const login = (await request(http).post('/auth/login').send({ email, password: 'secret123' })).body;
      return { token: login.accessToken as string, id: (await prisma.usuario.findUniqueOrThrow({ where: { email } })).id };
    };
    ({ token: tokenA } = await reg('a@e2e.cl', 'Juan'));
    ({ token: tokenB, id: idB } = await reg('b@e2e.cl', 'Zoily'));
    ({ token: tokenC, id: idC } = await reg('c@e2e.cl', 'Otro'));

    const hogarId = (await A(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)).body.id;
    await A(request(http).post('/comandos/InvitarMiembro')).send({ hogarId, emailInvitado: 'b@e2e.cl' }).expect(201);
    const inv = (await B(request(http).get('/usuarios/me/invitaciones?estado=PENDIENTE')).expect(200)).body[0];
    await B(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv.id }).expect(200);

    const cuenta = async (quien: typeof A, nombre: string, existencia: 'FAMILIAR' | 'PRIVADA') =>
      (
        await quien(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({
            nombre, tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 1_000_000, moneda: 'CLP', fechaAlta: '2024-01-01',
            visibilidadPorTipo: { EXISTENCIA: existencia, VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
          })
          .expect(201)
      ).body.id as string;
    cuentaA = await cuenta(A, 'Cuenta Juan', 'FAMILIAR');
    cuentaB = await cuenta(B, 'Cuenta Zoily', 'FAMILIAR');
    privadaA = await cuenta(A, 'Privada Juan', 'PRIVADA');
  });

  afterAll(async () => {
    await app.close();
  });

  it('valida las partes, el hogar y la cuenta donde se recibe, sin registrar el gasto', async () => {
    expect((await compartir(gasto(60_001)).expect(400)).body.codigo).toBe('PARTES_SUPERAN_TOTAL');
    expect(
      (await compartir({ ...gasto(1), partes: [{ usuarioId: idB, monto: 1 }, { usuarioId: idB, monto: 1 }] }).expect(400)).body.codigo,
    ).toBe('PARTES_NO_VALIDAS');
    expect((await compartir({ ...gasto(1), partes: [{ usuarioId: idC, monto: 1 }] }).expect(400)).body.codigo).toBe('NO_ES_MIEMBRO');
    // D-2: B no ve la cuenta privada de A, así que no podría transferirle.
    const r = await compartir(gasto(30_000, { cuentaDestinoId: privadaA })).expect(400);
    expect(r.body.codigo).toBe('DESTINO_NO_VISIBLE');
    expect(r.body.datos).toEqual({ cuentaId: privadaA, usuarioId: idB });
    expect(await valor(cuentaA)).toBe(1_000_000);
    expect(await lista(A)).toHaveLength(0);
  });

  it('A registra el gasto por el total y B recibe la solicitud por su parte', async () => {
    const r = await compartir(gasto(30_000)).expect(201);
    expect(r.body.gasto.monto).toBe(60_000);
    expect(r.body.solicitudes).toHaveLength(1);
    expect(await valor(cuentaA)).toBe(940_000);

    const deA = (await lista(A))[0];
    expect(deA).toMatchObject({ direccion: 'ENVIADA', estado: 'PENDIENTE', motivo: 'GASTO_COMPARTIDO', monto: 30_000, totalGasto: 60_000, glosa: 'Supermercado' });
    const deB = await solicitud(B, deA.id);
    expect(deB).toMatchObject({ direccion: 'RECIBIDA', estado: 'PENDIENTE', cuentaDisponible: true });
    const [n] = await avisos(B, 'SOLICITUD_APORTE');
    expect(n.titulo).toBe('Juan te pide tu parte');
    expect(n.entidadId).toBe(deA.id);
  });

  it('solo B la paga; el pago es una TRANSFERENCIA de Cuenta Zoily a Cuenta Juan', async () => {
    const id = (await lista(A))[0].id;
    expect((await pagar(id, A).expect(403)).body.codigo).toBe('SOLICITUD_AJENA');

    const r = await pagar(id).expect(200);
    expect(r.body.estado).toBe('PAGADA');
    expect(await valor(cuentaA)).toBe(970_000);
    expect(await valor(cuentaB, B)).toBe(970_000);
    expect((await solicitud(A, id)).estado).toBe('PAGADA');
    expect((await avisos(A, 'SOLICITUD_PAGADA'))[0].titulo).toBe('Zoily te transfirió su parte');
    // El aviso que pedía pagar ya no queda sin leer.
    const sinLeer = (await B(request(http).get('/usuarios/me/notificaciones?leida=false')).expect(200)).body as { entidadId: string }[];
    expect(sinLeer.some((n) => n.entidadId === id)).toBe(false);
    expect((await pagar(id).expect(409)).body.codigo).toBe('SOLICITUD_RESUELTA');
  });

  it('si B anula la transferencia, la solicitud vuelve a quedar pendiente', async () => {
    const s = (await lista(B))[0];
    await B(request(http).post('/comandos/AnularEventoFinanciero')).send({ eventoId: s.eventoPagoId, motivo: 'Me equivoqué' }).expect(200);
    expect((await solicitud(A, s.id)).estado).toBe('PENDIENTE');
    expect(await valor(cuentaA)).toBe(940_000);
  });

  it('"No me corresponde" la rechaza y avisa a A; después no se puede pagar', async () => {
    const id = (await lista(B))[0].id;
    const r = await B(request(http).post('/comandos/RechazarSolicitud')).send({ solicitudId: id }).expect(200);
    expect(r.body.estado).toBe('RECHAZADA');
    expect((await avisos(A, 'SOLICITUD_RECHAZADA'))[0].titulo).toBe('Zoily dice que no le corresponde');
    expect((await pagar(id).expect(409)).body.codigo).toBe('SOLICITUD_RESUELTA');
  });

  it('si A anula el gasto, la solicitud queda anulada', async () => {
    const r = await compartir(gasto(10_000, { glosa: 'Farmacia' })).expect(201);
    await A(request(http).post('/comandos/AnularEventoFinanciero')).send({ eventoId: r.body.gasto.id, motivo: 'Duplicado' }).expect(200);
    expect((await solicitud(B, r.body.solicitudes[0].id)).estado).toBe('ANULADA');
    expect((await pagar(r.body.solicitudes[0].id).expect(409)).body.codigo).toBe('SOLICITUD_RESUELTA');
  });

  it('si A deja de compartir la cuenta, B lo ve y no puede pagar (D-2)', async () => {
    const r = await compartir(gasto(5_000, { glosa: 'Pan' })).expect(201);
    const id = r.body.solicitudes[0].id as string;
    await A(request(http).post('/comandos/DefinirVisibilidadElementoPatrimonial'))
      .send({ elementoId: cuentaA, niveles: { EXISTENCIA: 'PRIVADA' } })
      .expect(200);
    expect((await solicitud(B, id)).cuentaDisponible).toBe(false);
    expect((await pagar(id).expect(403)).body.codigo).toBe('DESTINO_NO_PERMITIDO');
    await A(request(http).post('/comandos/DefinirVisibilidadElementoPatrimonial'))
      .send({ elementoId: cuentaA, niveles: { EXISTENCIA: 'FAMILIAR' } })
      .expect(200);
    expect((await solicitud(B, id)).cuentaDisponible).toBe(true);
  });

  it('Avisarle a B: la transferencia que B anota lleva la fecha en que llegó la plata', async () => {
    expect(
      (await A(request(http).post('/comandos/AvisarTransferenciaSinAnotar')).send({ usuarioId: idB, monto: 20_000, cuentaDestinoId: privadaA }).expect(400)).body.codigo,
    ).toBe('DESTINO_NO_VISIBLE');
    const r = await A(request(http).post('/comandos/AvisarTransferenciaSinAnotar'))
      .send({ usuarioId: idB, monto: 20_000, cuentaDestinoId: cuentaA, fecha: '2026-03-10' })
      .expect(201);
    expect(r.body).toMatchObject({ motivo: 'SIN_ANOTAR', estado: 'PENDIENTE', totalGasto: null });
    expect((await avisos(B, 'AVISO_TRANSFERENCIA'))[0].titulo).toBe('Juan te pide anotar una transferencia');

    const pago = await pagar(r.body.id).expect(200);
    const ev = (await B(request(http).get(`/eventos-financieros/${pago.body.eventoPagoId}`)).expect(200)).body;
    expect(ev).toMatchObject({ tipo: 'TRANSFERENCIA', monto: 20_000 });
    expect(ev.fecha.slice(0, 10)).toBe('2026-03-10');
    expect((await avisos(A, 'SOLICITUD_PAGADA'))[0].titulo).toBe('Zoily anotó la transferencia');
  });

  it('transferencias-hogar: cada uno ve las vigentes entre ustedes, con el nombre del otro', async () => {
    const de = async (quien: typeof A) =>
      (await quien(request(http).get('/usuarios/me/transferencias-hogar?dias=366')).expect(200)).body as Array<{
        direccion: string;
        miembro: { nombre: string };
        cuentaPropia: { nombre: string };
        monto: number;
      }>;
    // La primera transferencia de B se anuló: solo queda la del aviso.
    expect(await de(A)).toMatchObject([{ direccion: 'RECIBIDA', miembro: { nombre: 'Zoily' }, cuentaPropia: { nombre: 'Cuenta Juan' }, monto: 20_000 }]);
    expect(await de(B)).toMatchObject([{ direccion: 'ENVIADA', miembro: { nombre: 'Juan' }, cuentaPropia: { nombre: 'Cuenta Zoily' }, monto: 20_000 }]);
  });

  it('alguien de fuera del hogar no ve ni resuelve las solicitudes', async () => {
    const id = (await lista(A))[0].id;
    const C = (r: request.Test) => r.set('Authorization', `Bearer ${tokenC}`);
    expect(await lista(C)).toHaveLength(0);
    expect((await C(request(http).get('/usuarios/me/transferencias-hogar')).expect(200)).body).toEqual([]);
    expect((await pagar(id, C).expect(404)).body.codigo).toBe('SOLICITUD_NO_ENCONTRADA');
  });
});
