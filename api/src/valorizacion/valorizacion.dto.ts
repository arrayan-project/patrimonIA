import type { valorizacion as ValorizacionRow } from '@prisma/client';

export interface ValorizacionDTO {
  id: string;
  elementoId: string;
  valorAnterior: number;
  valorNuevo: number;
  fecha: string;
  anulada: boolean;
  /** Si no es null, esta valorización corrige a la indicada. */
  correccionDeId: string | null;
  createdAt: string;
}

export function toValorizacionDTO(v: ValorizacionRow): ValorizacionDTO {
  return {
    id: v.id,
    elementoId: v.elemento_id,
    valorAnterior: Number(v.valor_anterior),
    valorNuevo: Number(v.valor_nuevo),
    fecha: v.fecha.toISOString().slice(0, 10),
    anulada: v.anulada,
    correccionDeId: v.correccion_de_id,
    createdAt: v.created_at.toISOString(),
  };
}
