import type {
  evento_financiero as EventoRow,
  impacto_patrimonial as ImpactoRow,
} from '@prisma/client';

export interface EventoFinancieroDTO {
  id: string;
  tipo: string;
  monto: number;
  moneda: string;
  fecha: string;
  anulado: boolean;
  /** Si no es null, este evento es la corrección compensatoria del evento indicado. */
  correccionDeId: string | null;
  glosa: string | null;
  categoriaId: string | null;
  createdAt: string;
  impactos: {
    id: string;
    elementoId: string;
    monto: number;
  }[];
}

export function toEventoDTO(e: EventoRow, impactos: ImpactoRow[]): EventoFinancieroDTO {
  return {
    id: e.id,
    tipo: e.tipo,
    monto: Number(e.monto),
    moneda: e.moneda,
    fecha: e.fecha.toISOString().slice(0, 10),
    anulado: e.anulado,
    correccionDeId: e.correccion_de_id,
    glosa: e.glosa,
    categoriaId: e.categoria_id,
    createdAt: e.created_at.toISOString(),
    impactos: impactos.map((i) => ({
      id: i.id,
      elementoId: i.elemento_id,
      monto: Number(i.monto),
    })),
  };
}
