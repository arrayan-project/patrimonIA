import type {
  asignacion as AsignacionRow,
  objetivo_financiero as ObjetivoRow,
  reserva as ReservaRow,
} from '@prisma/client';

export interface ObjetivoFinancieroDTO {
  id: string;
  nombre: string;
  montoObjetivo: number;
  fechaObjetivo: string | null;
  estado: string;
  progreso: number;
  progresoPorcentaje: number;
  createdAt: string;
}

export interface ReservaDTO {
  id: string;
  asignacionId: string;
  elementoOrigenId: string;
  monto: number;
  estado: string;
  createdAt: string;
}

export interface AsignacionDTO {
  id: string;
  nombre: string;
  montoObjetivo: number | null;
  objetivoId: string | null;
  totalReservado: number;
  createdAt: string;
  reservas?: ReservaDTO[];
}

export function toObjetivoDTO(o: ObjetivoRow, progreso: number): ObjetivoFinancieroDTO {
  const monto = Number(o.monto_objetivo);
  return {
    id: o.id,
    nombre: o.nombre,
    montoObjetivo: monto,
    fechaObjetivo: o.fecha_objetivo ? o.fecha_objetivo.toISOString().slice(0, 10) : null,
    estado: o.estado,
    progreso,
    progresoPorcentaje: monto > 0 ? Math.round((progreso / monto) * 1000) / 10 : 0,
    createdAt: o.created_at.toISOString(),
  };
}

export function toReservaDTO(r: ReservaRow): ReservaDTO {
  return {
    id: r.id,
    asignacionId: r.asignacion_id,
    elementoOrigenId: r.elemento_origen_id,
    monto: Number(r.monto),
    estado: r.estado,
    createdAt: r.created_at.toISOString(),
  };
}

export function toAsignacionDTO(
  a: AsignacionRow,
  reservas: ReservaRow[],
  incluirReservas = false,
): AsignacionDTO {
  const total = reservas
    .filter((r) => r.estado === 'ACTIVA')
    .reduce((acc, r) => acc + Number(r.monto), 0);
  return {
    id: a.id,
    nombre: a.nombre,
    montoObjetivo: a.monto_objetivo === null ? null : Number(a.monto_objetivo),
    objetivoId: a.objetivo_financiero_id,
    totalReservado: total,
    createdAt: a.created_at.toISOString(),
    ...(incluirReservas ? { reservas: reservas.map(toReservaDTO) } : {}),
  };
}
