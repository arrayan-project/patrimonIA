/** Alcance de un reporte: los movimientos del usuario o los de todo el hogar. */
export type AlcanceReporte = 'mios' | 'hogar';

export interface MovimientoReporteDTO {
  eventoId: string;
  fecha: string;
  tipo: string;
  /** Monto neto tras las correcciones vivas. */
  monto: number;
  moneda: string;
  glosa: string | null;
  categoriaId: string | null;
  etiquetaIds: string[];
  corregido: boolean;
}

export interface TotalesPorMoneda {
  moneda: string;
  ingresos: number;
  gastos: number;
  /** ingresos − gastos. */
  balance: number;
}

export interface RubroReporteDTO {
  categoriaId: string | null;
  nombre: string;
  color: string | null;
  tipo: 'INGRESO' | 'GASTO';
  /** Σ montos del rubro en el período (sin conversión de moneda — ver GAPS.md G7/G16). */
  total: number;
}

export interface ResumenFinancieroDTO {
  periodo: { desde: string; hasta: string };
  alcance: AlcanceReporte;
  porMoneda: TotalesPorMoneda[];
  /** Un rubro por (categoría, tipo); "Sin clasificar" para los eventos sin categoría. */
  porRubro: RubroReporteDTO[];
  movimientos: MovimientoReporteDTO[];
}

export interface ResumenAnualDTO {
  anio: number;
  alcance: AlcanceReporte;
  /** 12 entradas (mes 1..12), cada una con sus totales por moneda. */
  meses: { mes: number; porMoneda: TotalesPorMoneda[] }[];
}
