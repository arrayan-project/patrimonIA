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

/** Una línea del presupuesto por rubro, con el nombre/color de la categoría. */
export interface PresupuestoLineaDTO {
  id: string;
  presupuestoId: string;
  categoriaId: string;
  nombre: string;
  color: string | null;
  tipoAplicable: string;
  montoEsperado: number;
}

/** Una línea de ahorro esperado por objetivo (GAPS.md P6). */
export interface PresupuestoLineaAhorroDTO {
  id: string;
  presupuestoId: string;
  objetivoId: string;
  nombre: string;
  montoEsperado: number;
}

/** Comparación esperado-vs-real del ahorro hacia un objetivo en el período. */
export interface DesviacionObjetivoDTO {
  objetivoId: string;
  nombre: string;
  esperado: number;
  /** Σ reserva.monto (estado != LIBERADA) hacia el objetivo, creadas en el período. */
  real: number;
  desviacion: number;
}

/** Comparación esperado-vs-real de un rubro dentro del período del presupuesto. */
export interface DesviacionRubroDTO {
  categoriaId: string;
  nombre: string;
  color: string | null;
  tipoAplicable: string;
  esperado: number;
  real: number;
  /** real − esperado (positivo = por encima de lo presupuestado). */
  desviacion: number;
}

export interface DesviacionPresupuestariaDTO {
  presupuestoId: string;
  periodo: { desde: string | null; hasta: string | null };
  esperado: { ingresos: number; gastos: number; ahorro: number };
  real: { ingresos: number; gastos: number; ahorro: number };
  /** real − esperado (positivo = por encima de lo presupuestado). */
  desviacion: { ingresos: number; gastos: number; ahorro: number };
  /** Desglose por rubro: una fila por línea del presupuesto, más los rubros con
   *  gasto/ingreso real pero sin línea (esperado 0). Ordenado por real desc. */
  porRubro: DesviacionRubroDTO[];
  /** Desglose por objetivo: una fila por línea de ahorro (GAPS.md P6). */
  porObjetivo: DesviacionObjetivoDTO[];
  /** Ingreso y gasto real del período sin categoría asignada. */
  sinClasificar: { ingresos: number; gastos: number };
}
