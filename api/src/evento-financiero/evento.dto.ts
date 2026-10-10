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
  /** Etiquetas (0..N, personales) del movimiento. */
  etiquetaIds: string[];
  createdAt: string;
  impactos: {
    id: string;
    elementoId: string;
    monto: number;
  }[];
  /**
   * G39 (M12): solo en GET /eventos-financieros/:id y si el evento tiene
   * correcciones vivas — cómo quedó después de ellas (lo que muestra la lista)
   * y la cadena de correcciones, de la primera a la última.
   */
  vigente?: { monto: number; fecha: string; glosa: string | null; correccionIds: string[] };
}

export function toEventoDTO(
  e: EventoRow,
  impactos: ImpactoRow[],
  etiquetaIds: string[] = [],
): EventoFinancieroDTO {
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
    etiquetaIds,
    createdAt: e.created_at.toISOString(),
    impactos: impactos.map((i) => ({
      id: i.id,
      elementoId: i.elemento_id,
      monto: Number(i.monto),
    })),
  };
}
