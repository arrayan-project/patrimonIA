import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Una entrada de auditoría registra un COMANDO ejecutado, con su contexto
 * (DDD Sección U) — no es un log de versionado de campos.
 *
 * Campos universales: comando, usuario responsable, fecha/hora, entidad afectada.
 * Campos condicionales: valor anterior/posterior, motivo, entidad relacionada,
 * encadenamiento a otra entrada.
 */
export type EntradaAuditoria = {
  comando: string;
  usuarioId: string;
  entidadTipo: string;
  entidadId: string;
  valorAnterior?: Prisma.InputJsonValue;
  valorPosterior?: Prisma.InputJsonValue;
  motivo?: string;
  entidadRelacionadaTipo?: string;
  entidadRelacionadaId?: string;
  encadenadaDeId?: string;
};

@Injectable()
export class AuditoriaService {
  /**
   * Escribe la entrada DENTRO de la transacción del comando que la origina.
   * No es un paso posterior ni opcional (DDD Sección U, BUILD_INSTRUCTIONS §5).
   */
  async registrar(tx: Prisma.TransactionClient, e: EntradaAuditoria): Promise<void> {
    await tx.auditoria.create({
      data: {
        comando: e.comando,
        usuario_id: e.usuarioId,
        fecha_hora: new Date(),
        entidad_tipo: e.entidadTipo,
        entidad_id: e.entidadId,
        valor_anterior: e.valorAnterior,
        valor_posterior: e.valorPosterior,
        motivo: e.motivo,
        entidad_relacionada_tipo: e.entidadRelacionadaTipo,
        entidad_relacionada_id: e.entidadRelacionadaId,
        encadenada_de_id: e.encadenadaDeId,
      },
    });
  }
}
