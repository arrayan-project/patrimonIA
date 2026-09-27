import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type notificacion as NotificacionRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUSH_SENDER, type PushSender } from './push-sender.js';

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
 * Notificaciones in-app (Principio 4 del DDD) + envío push best-effort.
 * NO son entidad del dominio: no generan auditoría y se pueden regenerar.
 */
@Injectable()
export class NotificacionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly push: PushSender,
  ) {}

  /**
   * Se llama DENTRO de la transacción del comando que dispara la política. El
   * push sale fuera de la transacción (best-effort) — si el comando termina
   * revertido, podría llegar un push huérfano (aceptable para un aviso).
   */
  async emitir(tx: Prisma.TransactionClient, n: NuevaNotificacion): Promise<void> {
    // G20 — el usuario puede silenciar un tipo desde `preferencias.notificaciones`
    // (ausente o distinto de false = habilitado).
    const dueno = await tx.usuario.findUnique({
      where: { id: n.usuarioId },
      select: { preferencias: true },
    });
    const prefs = (dueno?.preferencias ?? {}) as {
      notificaciones?: Record<string, boolean>;
    };
    if (prefs.notificaciones?.[n.tipo] === false) return;

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
    void this.#pushBestEffort(n.usuarioId, n.titulo, n.cuerpo);
  }

  async #pushBestEffort(usuarioId: string, titulo: string, cuerpo: string): Promise<void> {
    try {
      const disp = await this.prisma.dispositivo_push.findMany({
        where: { usuario_id: usuarioId },
        select: { expo_push_token: true },
      });
      if (disp.length > 0) {
        const invalidos = await this.push.enviar(disp.map((d) => d.expo_push_token), titulo, cuerpo);
        if (invalidos.length > 0) {
          await this.prisma.dispositivo_push.deleteMany({
            where: { usuario_id: usuarioId, expo_push_token: { in: invalidos } },
          });
        }
      }
    } catch {
      // best-effort
    }
  }

  // ── Dispositivos ──────────────────────────────────────────────────────────

  async registrarDispositivo(usuarioId: string, expoPushToken: string): Promise<{ ok: true }> {
    await this.prisma.dispositivo_push.upsert({
      where: { usuario_id_expo_push_token: { usuario_id: usuarioId, expo_push_token: expoPushToken } },
      create: { usuario_id: usuarioId, expo_push_token: expoPushToken },
      update: {},
    });
    return { ok: true };
  }

  async olvidarDispositivo(usuarioId: string, expoPushToken: string): Promise<{ ok: true }> {
    await this.prisma.dispositivo_push
      .delete({
        where: {
          usuario_id_expo_push_token: { usuario_id: usuarioId, expo_push_token: expoPushToken },
        },
      })
      .catch(() => undefined);
    return { ok: true };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

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
