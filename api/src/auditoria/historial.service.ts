import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface EntradaHistorialDTO {
  id: string;
  comando: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  valorAnterior: Record<string, unknown> | null;
  valorPosterior: Record<string, unknown> | null;
  motivo: string | null;
}

/** Tipos de entidad cuyo historial de auditoría se puede consultar desde la app. */
const TIPOS_SOPORTADOS = ['ELEMENTO_PATRIMONIAL', 'OBJETIVO_FINANCIERO', 'ASIGNACION'] as const;
type TipoSoportado = (typeof TIPOS_SOPORTADOS)[number];

/**
 * A5 — Reconstrucción de responsabilidad (DDD §V): "quién hizo qué y cuándo",
 * leído solo desde `auditoria`. No expone mecanismo, solo la traza.
 */
@Injectable()
export class HistorialService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    actorId: string,
    entidadTipo: string,
    entidadId: string,
  ): Promise<EntradaHistorialDTO[]> {
    if (!(TIPOS_SOPORTADOS as readonly string[]).includes(entidadTipo)) {
      throw new BadRequestException(
        `entidadTipo debe ser uno de: ${TIPOS_SOPORTADOS.join(', ')}`,
      );
    }
    await this.#exigirAcceso(actorId, entidadTipo as TipoSoportado, entidadId);

    const filas = await this.prisma.auditoria.findMany({
      where: { entidad_tipo: entidadTipo, entidad_id: entidadId },
      orderBy: { fecha_hora: 'desc' },
      include: { usuario: { select: { id: true, nombre: true } } },
    });

    return filas.map((f) => ({
      id: f.id,
      comando: f.comando,
      fecha: f.fecha_hora.toISOString(),
      usuarioId: f.usuario_id,
      usuarioNombre: f.usuario?.nombre ?? 'Usuario',
      valorAnterior: (f.valor_anterior as Record<string, unknown> | null) ?? null,
      valorPosterior: (f.valor_posterior as Record<string, unknown> | null) ?? null,
      motivo: f.motivo ?? null,
    }));
  }

  async #exigirAcceso(actorId: string, tipo: TipoSoportado, id: string): Promise<void> {
    if (tipo === 'ELEMENTO_PATRIMONIAL') {
      const prop = await this.prisma.elemento_propietario.findFirst({
        where: { elemento_id: id, usuario_id: actorId },
      });
      if (!prop) throw new ForbiddenException('No eres propietario de ese elemento');
      return;
    }
    if (tipo === 'OBJETIVO_FINANCIERO') {
      const o = await this.prisma.objetivo_financiero.findUnique({ where: { id } });
      if (!o) throw new NotFoundException('Objetivo no encontrado');
      if (o.usuario_id !== actorId) throw new ForbiddenException('El objetivo no es tuyo');
      return;
    }
    // ASIGNACION
    const a = await this.prisma.asignacion.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Asignación no encontrada');
    if (a.usuario_id !== actorId) throw new ForbiddenException('La asignación no es tuya');
  }
}
