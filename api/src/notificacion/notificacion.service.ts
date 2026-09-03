import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type notificacion as NotificacionRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface NotificacionDTO {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  entidadTipo: string | null;
  entidadId: string | null;
  leida: boolean;
  createdAt: string;
}

export interface NuevaNotificacion {
  usuarioId: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  entidadTipo?: string;
  entidadId?: string;
}

function toDTO(n: NotificacionRow): NotificacionDTO {
  return {
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    cuerpo: n.cuerpo,
    entidadTipo: n.entidad_tipo,
    entidadId: n.entidad_id,
    leida: n.leida,
    createdAt: n.created_at.toISOString(),
  };
}

/**
 * Notificaciones in-app (Principio 4 del DDD). NO son entidad del dominio: no
 * generan auditoría y se pueden regenerar. El envío real (push/email) queda
 * fuera de alcance.
 */
@Injectable()
export class NotificacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Se llama DENTRO de la transacción del comando que dispara la política. */
  async emitir(tx: Prisma.TransactionClient, n: NuevaNotificacion): Promise<void> {
    await tx.notificacion.create({
      data: {
        usuario_id: n.usuarioId,
        tipo: n.tipo,
        titulo: n.titulo,
        cuerpo: n.cuerpo,
        entidad_tipo: n.entidadTipo ?? null,
        entidad_id: n.entidadId ?? null,
        leida: false,
      },
    });
  }

  async listar(usuarioId: string, soloNoLeidas: boolean): Promise<NotificacionDTO[]> {
    const filas = await this.prisma.notificacion.findMany({
      where: { usuario_id: usuarioId, ...(soloNoLeidas ? { leida: false } : {}) },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return filas.map(toDTO);
  }

  async contarNoLeidas(usuarioId: string): Promise<{ noLeidas: number }> {
    return { noLeidas: await this.prisma.notificacion.count({ where: { usuario_id: usuarioId, leida: false } }) };
  }

  async marcarLeida(usuarioId: string, notificacionId: string): Promise<NotificacionDTO> {
    const n = await this.prisma.notificacion.findUnique({ where: { id: notificacionId } });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    if (n.usuario_id !== usuarioId) throw new ForbiddenException('No es tuya');
    return toDTO(
      await this.prisma.notificacion.update({ where: { id: notificacionId }, data: { leida: true } }),
    );
  }

  async marcarTodasLeidas(usuarioId: string): Promise<{ marcadas: number }> {
    const r = await this.prisma.notificacion.updateMany({
      where: { usuario_id: usuarioId, leida: false },
      data: { leida: true },
    });
    return { marcadas: r.count };
  }
}
