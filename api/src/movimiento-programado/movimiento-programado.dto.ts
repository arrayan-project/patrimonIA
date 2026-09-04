import type { movimiento_programado as MovimientoRow } from '@prisma/client';

export interface MovimientoProgramadoDTO {
  id: string;
  tipo: string;
  montoPlanificado: number;
  moneda: string;
  fechaProgramada: string;
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  observaciones: string | null;
  estado: string;
  /** Presente si estado = MATERIALIZADO. */
  eventoFinancieroId: string | null;
  createdAt: string;
}

export function toMovimientoProgramadoDTO(
  m: MovimientoRow,
  eventoFinancieroId: string | null = null,
): MovimientoProgramadoDTO {
  return {
    id: m.id,
    tipo: m.tipo,
    montoPlanificado: Number(m.monto_planificado),
    moneda: m.moneda,
    fechaProgramada: m.fecha_programada.toISOString().slice(0, 10),
    elementoOrigenId: m.elemento_origen_id,
    elementoDestinoId: m.elemento_destino_id,
    observaciones: m.observaciones,
    estado: m.estado,
    eventoFinancieroId,
    createdAt: m.created_at.toISOString(),
  };
}
