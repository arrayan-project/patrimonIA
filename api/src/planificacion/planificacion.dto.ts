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
  /** P11: etiqueta de moneda (sin conversión). */
  moneda: string;
  /** P9: hogar con el que se comparte. null = objetivo personal. */
  hogarId: string | null;
  /** P9: usuarios que pueden modificarlo (además del dueño). Compartidos → [...]. */
  designados: string[];
  /** true si el actor es el dueño del objetivo. */
  esMio: boolean;
  /** true si el actor puede modificar (dueño o designado). */
  puedoModificar: boolean;
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
  /** P11: etiqueta de moneda (sin conversión). */
  moneda: string;
  createdAt: string;
  reservas?: ReservaDTO[];
}

/** Reserva ACTIVA vista desde el elemento que la financia (REQUISITES §F, §A2). */
export interface ReservaDeElementoDTO {
  id: string;
  monto: number;
  asignacionId: string;
  asignacionNombre: string;
  objetivoId: string | null;
  objetivoNombre: string | null;
  createdAt: string;
}

export function toObjetivoDTO(
  o: ObjetivoRow,
  progreso: number,
  extra: { designados?: string[]; actorId?: string } = {},
): ObjetivoFinancieroDTO {
  const monto = Number(o.monto_objetivo);
  const designados = extra.designados ?? [];
  const esMio = extra.actorId !== undefined && o.usuario_id === extra.actorId;
  return {
    id: o.id,
    nombre: o.nombre,
    montoObjetivo: monto,
    fechaObjetivo: o.fecha_objetivo ? o.fecha_objetivo.toISOString().slice(0, 10) : null,
    estado: o.estado,
    progreso,
    progresoPorcentaje: monto > 0 ? Math.round((progreso / monto) * 1000) / 10 : 0,
    createdAt: o.created_at.toISOString(),
    moneda: o.moneda,
    hogarId: o.hogar_id,
    designados,
    esMio,
    puedoModificar: esMio || (extra.actorId !== undefined && designados.includes(extra.actorId)),
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
    moneda: a.moneda ?? 'CLP',
    createdAt: a.created_at.toISOString(),
    ...(incluirReservas ? { reservas: reservas.map(toReservaDTO) } : {}),
  };
}
