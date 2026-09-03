import type { presupuesto as PresupuestoRow } from '@prisma/client';

export interface PresupuestoDTO {
  id: string;
  tipo: string;
  periodicidad: string;
  intervalo: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  ingresosEsperados: number | null;
  gastosEsperados: number | null;
  ahorroEsperado: number | null;
  estado: string | null;
  usuarioId: string | null;
  hogarId: string | null;
  /** Derivada: ESPECIFICO → estado ACTIVO; PERIODICO → hoy dentro del intervalo. */
  vigente: boolean;
  createdAt: string;
}

const soloFecha = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Vigencia: para PERIODICO es calendario (DATABASE_DESIGN §10), para ESPECIFICO es el estado. */
export function esVigente(p: PresupuestoRow, hoy = new Date()): boolean {
  if (p.periodicidad === 'ESPECIFICO') return p.estado === 'ACTIVO';
  const hoyStr = hoy.toISOString().slice(0, 10);
  const desde = soloFecha(p.fecha_inicio);
  const hasta = soloFecha(p.fecha_fin);
  if (desde && hoyStr < desde) return false;
  if (hasta && hoyStr > hasta) return false;
  return true;
}

export function toPresupuestoDTO(p: PresupuestoRow): PresupuestoDTO {
  return {
    id: p.id,
    tipo: p.tipo,
    periodicidad: p.periodicidad,
    intervalo: p.intervalo,
    fechaInicio: soloFecha(p.fecha_inicio),
    fechaFin: soloFecha(p.fecha_fin),
    ingresosEsperados: p.ingresos_esperados === null ? null : Number(p.ingresos_esperados),
    gastosEsperados: p.gastos_esperados === null ? null : Number(p.gastos_esperados),
    ahorroEsperado: p.ahorro_esperado === null ? null : Number(p.ahorro_esperado),
    estado: p.estado,
    usuarioId: p.usuario_id,
    hogarId: p.hogar_id,
    vigente: esVigente(p),
    createdAt: p.created_at.toISOString(),
  };
}

export interface DesviacionPresupuestariaDTO {
  presupuestoId: string;
  periodo: { desde: string | null; hasta: string | null };
  esperado: { ingresos: number; gastos: number; ahorro: number };
  real: { ingresos: number; gastos: number; ahorro: number };
  /** real − esperado (positivo = por encima de lo presupuestado). */
  desviacion: { ingresos: number; gastos: number; ahorro: number };
}
