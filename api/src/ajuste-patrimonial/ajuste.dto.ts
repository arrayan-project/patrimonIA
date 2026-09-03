import type { ajuste_patrimonial as AjusteRow } from '@prisma/client';

export interface AjustePatrimonialDTO {
  id: string;
  elementoId: string;
  monto: number;
  motivo: string;
  fecha: string;
  anulado: boolean;
  correccionDeId: string | null;
  createdAt: string;
}

export function toAjusteDTO(a: AjusteRow): AjustePatrimonialDTO {
  return {
    id: a.id,
    elementoId: a.elemento_id,
    monto: Number(a.monto),
    motivo: a.motivo,
    fecha: a.fecha.toISOString().slice(0, 10),
    anulado: a.anulado,
    correccionDeId: a.correccion_de_id,
    createdAt: a.created_at.toISOString(),
  };
}
