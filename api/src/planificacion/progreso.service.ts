import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/**
 * Proyección progreso_objetivo (DATABASE_DESIGN §12) y política "Completar
 * objetivo" (Principio 4: inferencia automática con control humano).
 */
@Injectable()
export class ProgresoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Suma de reservas ACTIVAS de las asignaciones asociadas al objetivo. */
  async progresoDeObjetivo(
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

  /**
   * Valor libre de un elemento = valor_vigente − reservas ACTIVAS sobre él.
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
  }
}
