import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { MovimientoProgramadoService } from './../src/movimiento-programado/movimiento-programado.service.js';
import { hoyChile } from './../src/movimiento-programado/recurrencia.js';

/**
 * Fase 7 — Movimiento Programado (agregado propio, AS #13–#16).
 * Planificación: no toca patrimonio hasta materializarse, y entonces dispara un
 * Evento Financiero INGRESO hacia el elemento destino (GAPS.md G2).
 */
describe('Movimiento Programado (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: App;
  let token: string;
  let cuentaId: string;

  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

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
      'TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva, presupuesto, movimiento_programado RESTART IDENTITY CASCADE',
    );
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'mp@e2e.cl', nombre: 'MP', password: 'secret123' })
      .expect(201);
    token = (
      await request(http).post('/auth/login').send({ email: 'mp@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    cuentaId = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre: 'Cuenta',
          tipo: 'cuenta_corriente',
          categoriaFuncional: 'LIQUIDEZ',
          valorInicial: 500_000,
          moneda: 'CLP',
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea un movimiento PENDIENTE sin tocar el patrimonio', async () => {
    const m = await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({
        tipo: 'INGRESO',
        montoPlanificado: 300_000,
        moneda: 'CLP',
        fechaProgramada: '2020-01-15',
        elementoDestinoId: cuentaId,
        observaciones: 'sueldo',
      })
      .expect(201);
    expect(m.body.estado).toBe('PENDIENTE');
    expect(m.body.eventoFinancieroId).toBeNull();

    const el = await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200);
    expect(el.body.valorVigente).toBe(500_000); // sin cambios
  });

  it('rechaza moneda que no calza con el elemento destino', async () => {
    await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({ tipo: 'INGRESO', montoPlanificado: 100, moneda: 'USD', fechaProgramada: '2020-02-01', elementoDestinoId: cuentaId })
      .expect(400);
  });

  it('actualiza solo mientras esté PENDIENTE', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'INGRESO', montoPlanificado: 100_000, moneda: 'CLP', fechaProgramada: '2020-03-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    const upd = await auth(request(http).post('/comandos/ActualizarMovimientoProgramado'))
      .send({ movimientoId: id, montoPlanificado: 120_000 })
      .expect(200);
    expect(upd.body.montoPlanificado).toBe(120_000);
  });

  it('no materializa antes de la fecha programada', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'INGRESO', montoPlanificado: 50_000, moneda: 'CLP', fechaProgramada: '2999-01-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(400);
  });

  it('materializa: genera un INGRESO, mueve el valor_vigente y encadena la auditoría', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'INGRESO', montoPlanificado: 300_000, moneda: 'CLP', fechaProgramada: '2020-06-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;

    const mat = await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id, montoEfectivo: 320_000, fechaEfectiva: '2020-06-03' })
      .expect(200);
    expect(mat.body.estado).toBe('MATERIALIZADO');
    expect(mat.body.eventoFinancieroId).toBeTruthy();

    const el = await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200);
    expect(el.body.valorVigente).toBe(820_000); // 500.000 + 320.000

    const evento = await auth(
      request(http).get(`/eventos-financieros/${mat.body.eventoFinancieroId}`),
    ).expect(200);
    expect(evento.body.tipo).toBe('INGRESO');
    expect(evento.body.monto).toBe(320_000);

    // una sola entrada de auditoría, bajo el comando de materializar
    const rows = await prisma.auditoria.count({
      where: { comando: 'MaterializarMovimientoProgramado', entidad_id: id },
    });
    expect(rows).toBe(1);
    const registrarEvento = await prisma.auditoria.count({
      where: { comando: 'RegistrarEventoFinanciero', entidad_id: mat.body.eventoFinancieroId },
    });
    expect(registrarEvento).toBe(0);

    // ya materializado → no se puede actualizar ni cancelar
    await auth(request(http).post('/comandos/ActualizarMovimientoProgramado'))
      .send({ movimientoId: id, montoPlanificado: 1 })
      .expect(409);
    await auth(request(http).post('/comandos/CancelarMovimientoProgramado'))
      .send({ movimientoId: id, motivo: 'tarde' })
      .expect(409);
  });

  it('cancela un movimiento pendiente y bloquea acciones posteriores', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'INGRESO', montoPlanificado: 10_000, moneda: 'CLP', fechaProgramada: '2020-07-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    await auth(request(http).post('/comandos/CancelarMovimientoProgramado'))
      .send({ movimientoId: id, motivo: 'ya no aplica' })
      .expect(200);
    await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(409);
  });

  it('otro usuario no ve ni toca un movimiento de un elemento ajeno', async () => {
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'INGRESO', montoPlanificado: 1_000, moneda: 'CLP', fechaProgramada: '2020-08-01', elementoDestinoId: cuentaId })
        .expect(201)
    ).body.id;
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'ajeno@e2e.cl', nombre: 'Ajeno', password: 'secret123' })
      .expect(201);
    const otro = (
      await request(http).post('/auth/login').send({ email: 'ajeno@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    await request(http)
      .get(`/movimientos-programados/${id}`)
      .set('Authorization', `Bearer ${otro}`)
      .expect(403);
  });

  it('lista los movimientos pendientes del usuario', async () => {
    const pendientes = await auth(
      request(http).get('/movimientos-programados?estado=PENDIENTE'),
    ).expect(200);
    expect(Array.isArray(pendientes.body)).toBe(true);
    expect(pendientes.body.every((m: { estado: string }) => m.estado === 'PENDIENTE')).toBe(true);
  });

  it('§B5 — programa un GASTO y lo materializa (evento GASTO, baja el saldo)', async () => {
    await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({ tipo: 'GASTO', montoPlanificado: 1, moneda: 'CLP', fechaProgramada: '2020-01-01', elementoDestinoId: cuentaId })
      .expect(400); // GASTO no lleva destino

    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({
          tipo: 'GASTO',
          montoPlanificado: 40_000,
          moneda: 'CLP',
          fechaProgramada: '2020-05-01',
          elementoOrigenId: cuentaId,
          observaciones: 'arriendo',
        })
        .expect(201)
    ).body.id;

    const antes = (await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200))
      .body.valorVigente;
    const mat = await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(200);
    const ev = await auth(
      request(http).get(`/eventos-financieros/${mat.body.eventoFinancieroId}`),
    ).expect(200);
    expect(ev.body.tipo).toBe('GASTO');
    const despues = (await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200))
      .body.valorVigente;
    expect(despues).toBe(antes - 40_000);
  });

  it('§B5 — programa una TRANSFERENCIA y la materializa (dos impactos)', async () => {
    const destino = (
      await auth(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({ nombre: 'Ahorro', tipo: 'cuenta_ahorro', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'CLP' })
        .expect(201)
    ).body.id;

    await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({ tipo: 'TRANSFERENCIA', montoPlanificado: 10, moneda: 'CLP', fechaProgramada: '2020-01-01', elementoOrigenId: cuentaId, elementoDestinoId: cuentaId })
      .expect(400); // origen == destino

    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({
          tipo: 'TRANSFERENCIA',
          montoPlanificado: 25_000,
          moneda: 'CLP',
          fechaProgramada: '2020-05-01',
          elementoOrigenId: cuentaId,
          elementoDestinoId: destino,
        })
        .expect(201)
    ).body.id;

    const origenAntes = (
      await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200)
    ).body.valorVigente;
    await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(200);

    expect(
      (await auth(request(http).get(`/elementos-patrimoniales/${cuentaId}`)).expect(200)).body
        .valorVigente,
    ).toBe(origenAntes - 25_000);
    expect(
      (await auth(request(http).get(`/elementos-patrimoniales/${destino}`)).expect(200)).body
        .valorVigente,
    ).toBe(25_000);
  });
  it('D-5: programa una TRANSFERENCIA a la cuenta de otro miembro (D-2) y la materializa', async () => {
    const hogarId = (await auth(request(http).post('/comandos/CrearHogar')).send({ nombre: 'Casa' }).expect(201)).body.id;
    await request(http)
      .post('/comandos/RegistrarUsuario')
      .send({ email: 'pareja@e2e.cl', nombre: 'Pareja', password: 'secret123' })
      .expect(201);
    const tokenP = (
      await request(http).post('/auth/login').send({ email: 'pareja@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    const P = (r: request.Test) => r.set('Authorization', `Bearer ${tokenP}`);
    await auth(request(http).post('/comandos/InvitarMiembro')).send({ hogarId, emailInvitado: 'pareja@e2e.cl' }).expect(201);
    const inv = (await P(request(http).get('/usuarios/me/invitaciones?estado=PENDIENTE')).expect(200)).body[0];
    await P(request(http).post('/comandos/AceptarInvitacion')).send({ invitacionId: inv.id }).expect(200);
    const cuentaDe = async (nombre: string, existencia: 'FAMILIAR' | 'PRIVADA') =>
      (
        await P(request(http).post('/comandos/RegistrarElementoPatrimonial'))
          .send({
            nombre, tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'CLP',
            visibilidadPorTipo: { EXISTENCIA: existencia, VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
          })
          .expect(201)
      ).body.id as string;
    const compartida = await cuentaDe('Cuenta pareja', 'FAMILIAR');
    const privada = await cuentaDe('Privada pareja', 'PRIVADA');
    const programar = (destino: string) =>
      auth(request(http).post('/comandos/CrearMovimientoProgramado')).send({
        tipo: 'TRANSFERENCIA', montoPlanificado: 7_000, moneda: 'CLP', fechaProgramada: '2020-06-01',
        elementoOrigenId: cuentaId, elementoDestinoId: destino,
      });

    await programar(privada).expect(403);
    const id = (await programar(compartida).expect(201)).body.id;

    // Lo opera quien lo programó (el origen es suyo); la pareja no lo ve como propio.
    await auth(request(http).get(`/movimientos-programados/${id}`)).expect(200);
    await P(request(http).get(`/movimientos-programados/${id}`)).expect(403);
    const deLaPareja = (await P(request(http).get('/movimientos-programados')).expect(200)).body as Array<{ id: string }>;
    expect(deLaPareja.map((m) => m.id)).not.toContain(id);

    await auth(request(http).post('/comandos/MaterializarMovimientoProgramado')).send({ movimientoId: id }).expect(200);
    expect(
      (await P(request(http).get(`/elementos-patrimoniales/${compartida}`)).expect(200)).body.valorVigente,
    ).toBe(7_000);
  });

  it('D-5: no materializa si el miembro dejó de compartir la cuenta de destino', async () => {
    const tokenP = (
      await request(http).post('/auth/login').send({ email: 'pareja@e2e.cl', password: 'secret123' })
    ).body.accessToken;
    const P = (r: request.Test) => r.set('Authorization', `Bearer ${tokenP}`);
    const cuenta = (
      await P(request(http).post('/comandos/RegistrarElementoPatrimonial'))
        .send({
          nombre: 'Cuenta que se cierra', tipo: 'cuenta_corriente', categoriaFuncional: 'LIQUIDEZ', valorInicial: 0, moneda: 'CLP',
          visibilidadPorTipo: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
        })
        .expect(201)
    ).body.id;
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'TRANSFERENCIA', montoPlanificado: 1_000, moneda: 'CLP', fechaProgramada: '2020-06-01', elementoOrigenId: cuentaId, elementoDestinoId: cuenta })
        .expect(201)
    ).body.id;
    await P(request(http).post('/comandos/DefinirVisibilidadElementoPatrimonial'))
      .send({ elementoId: cuenta, niveles: { EXISTENCIA: 'PRIVADA' } })
      .expect(200);
    const r = await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id })
      .expect(403);
    expect(r.body.codigo).toBe('DESTINO_NO_PERMITIDO');
  });

  // ── D-6: recurrencia y aviso "¿Se pagó?" ──────────────────────────────────

  const serie = async (serieId: string) =>
    (await auth(request(http).get('/movimientos-programados')).expect(200)).body
      .filter((m: { serieId: string }) => m.serieId === serieId)
      .sort((a: { fechaProgramada: string }, b: { fechaProgramada: string }) => a.fechaProgramada.localeCompare(b.fechaProgramada));

  it('D-6: una serie que llega a su fecha genera la siguiente y avisa una sola vez "¿Se pagó?"', async () => {
    const hoy = hoyChile();
    const cat = await prisma.categoria_movimiento.findFirstOrThrow({ where: { tipo_aplicable: 'GASTO' } });
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({
          tipo: 'GASTO', montoPlanificado: 35_000, moneda: 'CLP', fechaProgramada: hoy, elementoOrigenId: cuentaId,
          observaciones: 'Luz', periodicidad: 'MENSUAL', categoriaId: cat.id,
        })
        .expect(201)
    ).body.id;

    // Dos revisiones a la vez (cron y lectura) no duplican nada.
    const svc = app.get(MovimientoProgramadoService);
    await Promise.all([svc.revisarVencidos(), svc.revisarVencidos()]);
    const filas = await serie(id);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ id, fechaProgramada: hoy, estado: 'PENDIENTE', periodicidad: 'MENSUAL' });
    expect(filas[1]).toMatchObject({ estado: 'PENDIENTE', periodicidad: 'MENSUAL', categoriaId: cat.id, montoPlanificado: 35_000 });
    expect(filas[1].fechaProgramada > hoy).toBe(true);

    const avisos = await prisma.notificacion.findMany({ where: { tipo: 'PROGRAMADO_VENCIDO', entidad_id: id } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toBe('Luz · 35.000 CLP');
    expect(avisos[0].cuerpo).toMatch(/^¿Se pagó\?/);
    expect(await prisma.notificacion.count({ where: { entidad_id: filas[1].id } })).toBe(0);

    // Confirmar con otro monto: el evento lleva la categoría y el detalle; la serie sigue.
    const mat = await auth(request(http).post('/comandos/MaterializarMovimientoProgramado'))
      .send({ movimientoId: id, montoEfectivo: 37_000 })
      .expect(200);
    const ev = await prisma.evento_financiero.findUniqueOrThrow({ where: { id: mat.body.eventoFinancieroId } });
    expect(ev).toMatchObject({ categoria_id: cat.id, glosa: 'Luz' });
    expect(Number(ev.monto)).toBe(37_000);
    expect((await serie(id))[1].estado).toBe('PENDIENTE');
  });

  it('D-6: una serie con fecha pasada se pone al día; las vencidas quedan pendientes', async () => {
    const [y, m] = hoyChile().split('-').map(Number);
    const desde = new Date(Date.UTC(y, m - 3, 1)).toISOString().slice(0, 10); // día 1, hace dos meses
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'INGRESO', montoPlanificado: 900_000, moneda: 'CLP', fechaProgramada: desde, elementoDestinoId: cuentaId, periodicidad: 'MENSUAL' })
        .expect(201)
    ).body.id;
    const filas = await serie(id);
    expect(filas).toHaveLength(4); // hace 2 meses, el mes pasado, este mes y el próximo
    expect(filas.every((f: { estado: string }) => f.estado === 'PENDIENTE')).toBe(true);
    const aviso = await prisma.notificacion.findFirstOrThrow({ where: { entidad_id: id } });
    expect(aviso.titulo).toBe('Ingreso programado · 900.000 CLP');
    expect(aviso.cuerpo).toMatch(/^¿Llegó\?/);
    expect(await prisma.notificacion.count({ where: { entidad_id: filas[3].id } })).toBe(0);
  });

  it('D-6: dejar de repetir cancela solo las que no llegan y no genera más', async () => {
    const [y, m] = hoyChile().split('-').map(Number);
    const desde = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10); // día 1 del mes pasado
    const id = (
      await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
        .send({ tipo: 'GASTO', montoPlanificado: 20_000, moneda: 'CLP', fechaProgramada: desde, elementoOrigenId: cuentaId, periodicidad: 'MENSUAL' })
        .expect(201)
    ).body.id;
    expect(await serie(id)).toHaveLength(3);

    const r = await auth(request(http).post('/comandos/CancelarMovimientoProgramado'))
      .send({ movimientoId: id, motivo: 'Ya no se repite', serie: true })
      .expect(200);
    expect(r.body.periodicidad).toBeNull();
    const filas = await serie(id);
    expect(filas).toHaveLength(3);
    expect(filas.map((f: { estado: string }) => f.estado)).toEqual(['PENDIENTE', 'PENDIENTE', 'CANCELADO']);
    expect(filas.every((f: { periodicidad: string | null }) => f.periodicidad === null)).toBe(true);

    await auth(request(http).post('/comandos/CancelarMovimientoProgramado'))
      .send({ movimientoId: id, motivo: 'otra vez', serie: true })
      .expect(400);
  });

  it('D-6: la categoría solo va en ingresos y gastos, y debe aplicar al tipo', async () => {
    const ingreso = await prisma.categoria_movimiento.findFirstOrThrow({ where: { tipo_aplicable: 'INGRESO' } });
    await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({ tipo: 'GASTO', montoPlanificado: 1, moneda: 'CLP', fechaProgramada: '2030-01-01', elementoOrigenId: cuentaId, categoriaId: ingreso.id })
      .expect(400);
    await auth(request(http).post('/comandos/CrearMovimientoProgramado'))
      .send({ tipo: 'GASTO', montoPlanificado: 1, moneda: 'CLP', fechaProgramada: '2030-01-01', elementoOrigenId: cuentaId, periodicidad: 'SEMANAL' })
      .expect(400);
  });
});
