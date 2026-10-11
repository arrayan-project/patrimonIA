import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';

/**
 * Proyección progreso_objetivo (DATABASE_DESIGN §12) y política "Completar
 * objetivo" (Principio 4: inferencia automática con control humano).
 */
@Injectable()
export class ProgresoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionService,
  ) {}

  /**
   * Progreso = apartados fijos (reservas ACTIVAS de sus asignaciones) + valor
   * actual de sus cuentas dedicadas (Bloque M, M-2).
   */
  async progresoDeObjetivo(
    objetivoId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const [apartado, cuentas] = await Promise.all([
      this.apartadoDeObjetivo(objetivoId, client),
      this.cuentasDedicadas(objetivoId, client),
    ]);
    return apartado + cuentas.reduce((s, c) => s + c.valor, 0);
  }

  /** Suma de reservas ACTIVAS de las asignaciones asociadas al objetivo (lo apartado fijo). */
  async apartadoDeObjetivo(
    objetivoId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const asignaciones = await client.asignacion.findMany({
      where: { objetivo_financiero_id: objetivoId },
      select: { id: true },
    });
    if (asignaciones.length === 0) return 0;
    const reservas = await client.reserva.findMany({
      where: { asignacion_id: { in: asignaciones.map((a) => a.id) }, estado: 'ACTIVA' },
      select: { monto: true },
    });
    return reservas.reduce((acc, r) => acc + Number(r.monto), 0);
  }

  /** Bloque M — las cuentas dedicadas (activas) del objetivo, con su valor de hoy. */
  async cuentasDedicadas(
    objetivoId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ elementoId: string; nombre: string; valor: number; moneda: string }[]> {
    const filas = await client.objetivo_cuenta_dedicada.findMany({
      where: { objetivo_id: objetivoId, elemento_patrimonial: { estado: 'ACTIVO' } },
      include: { elemento_patrimonial: true },
      orderBy: { created_at: 'asc' },
    });
    return filas.map((f) => ({
      elementoId: f.elemento_id,
      nombre: f.elemento_patrimonial.nombre,
      valor: Number(f.elemento_patrimonial.valor_vigente),
      moneda: f.elemento_patrimonial.moneda,
    }));
  }

  /**
   * Bloque M — cuánto cambió este mes (calendario) el valor de las cuentas
   * dedicadas: valor de hoy − valor al cierre del mes anterior (impactos vivos
   * posteriores, como ReconstruccionService). "📉 −X este mes" en la meta.
   */
  async cambioMesCuentas(objetivoId: string, hoy = new Date()): Promise<number> {
    const filas = await this.prisma.objetivo_cuenta_dedicada.findMany({
      where: { objetivo_id: objetivoId, elemento_patrimonial: { estado: 'ACTIVO' } },
      select: { elemento_id: true },
    });
    if (filas.length === 0) return 0;
    const inicioMes = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), 1));
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { elemento_id: { in: filas.map((f) => f.elemento_id) }, fecha: { gte: inicioMes } },
    });
    const anulados = new Set(
      (
        await this.prisma.evento_financiero.findMany({
          where: {
            id: { in: impactos.filter((i) => i.origen_tipo === 'EVENTO_FINANCIERO').map((i) => i.origen_id) },
            anulado: true,
          },
          select: { id: true },
        })
      ).map((e) => e.id),
    );
    return impactos
      .filter((i) => !(i.origen_tipo === 'EVENTO_FINANCIERO' && anulados.has(i.origen_id)))
      .reduce((s, i) => s + Number(i.monto), 0);
  }

  /**
   * Bloque M (M-2) — después de mover o valorizar estas cuentas: si alguna es
   * dedicada, recalcula su meta y evalúa "Completar objetivo" (solo completa).
   */
  async completarPorCuentas(
    tx: Prisma.TransactionClient,
    elementoIds: string[],
    usuarioId: string,
    entradaComandoRaizId: string,
  ): Promise<void> {
    if (elementoIds.length === 0) return;
    const dedicadas = await tx.objetivo_cuenta_dedicada.findMany({
      where: { elemento_id: { in: elementoIds } },
      select: { objetivo_id: true },
    });
    for (const objetivoId of new Set(dedicadas.map((d) => d.objetivo_id))) {
      await this.recalcularYCompletar(tx, objetivoId, usuarioId, entradaComandoRaizId);
    }
  }

  /**
   * Valor libre de un elemento = valor_vigente − reservas ACTIVAS sobre él
   * (0 si está dedicada a una meta, Bloque M).
   * `excluirReservaId` permite re-validar una reserva que se está ajustando.
   */
  async disponibilidad(
    elementoId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    excluirReservaId?: string,
  ): Promise<number> {
    const elemento = await client.elemento_patrimonial.findUniqueOrThrow({
      where: { id: elementoId },
    });
    // Bloque M (M-3): una cuenta dedicada es toda de su meta; no queda nada libre.
    const dedicada = await client.objetivo_cuenta_dedicada.findUnique({ where: { elemento_id: elementoId } });
    if (dedicada) return 0;
    const reservas = await client.reserva.findMany({
      where: {
        elemento_origen_id: elementoId,
        estado: 'ACTIVA',
        ...(excluirReservaId ? { id: { not: excluirReservaId } } : {}),
      },
      select: { monto: true },
    });
    const reservado = reservas.reduce((acc, r) => acc + Number(r.monto), 0);
    return Number(elemento.valor_vigente) - reservado;
  }

  /**
   * Recalcula el progreso de un objetivo y, si alcanzó el monto objetivo estando
   * EN_PROGRESO, dispara la política "Completar objetivo": pasa a COMPLETADO y
   * escribe SU PROPIA entrada de auditoría encadenada al comando que la originó
   * (DATABASE_DESIGN §11 — política que se ramifica genera fila propia).
   * La política solo completa; nunca revierte (el usuario tiene la última palabra).
   */
  async recalcularYCompletar(
    tx: Prisma.TransactionClient,
    objetivoId: string,
    usuarioId: string,
    entradaComandoRaizId: string,
  ): Promise<void> {
    const objetivo = await tx.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!objetivo || objetivo.estado !== 'EN_PROGRESO') return;

    const progreso = await this.progresoDeObjetivo(objetivoId, tx);
    if (progreso < Number(objetivo.monto_objetivo)) return;

    await tx.objetivo_financiero.update({
      where: { id: objetivoId },
      data: { estado: 'COMPLETADO' },
    });
    await this.auditoria.registrar(tx, {
      comando: 'CompletarObjetivo',
      usuarioId,
      entidadTipo: 'OBJETIVO_FINANCIERO',
      entidadId: objetivoId,
      valorAnterior: { estado: 'EN_PROGRESO' },
      valorPosterior: { estado: 'COMPLETADO', progreso },
      encadenadaDeId: entradaComandoRaizId,
    });
    await this.notificaciones.emitir(tx, {
      usuarioId: objetivo.usuario_id ?? usuarioId,
      tipo: 'OBJETIVO_COMPLETADO',
      titulo: 'Objetivo completado',
      cuerpo: `"${objetivo.nombre}" alcanzó su monto objetivo (${progreso}).`,
      entidadTipo: 'OBJETIVO_FINANCIERO',
      entidadId: objetivoId,
    });
  }
}
