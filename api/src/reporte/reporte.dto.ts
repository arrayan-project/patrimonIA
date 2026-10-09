/** Alcance de un reporte: los movimientos del usuario o los de todo el hogar. */
export type AlcanceReporte = 'mios' | 'hogar';

export interface MovimientoReporteDTO {
  eventoId: string;
  fecha: string;
  /** INGRESO · GASTO · TRANSFERENCIA · CONVERSION. */
  tipo: string;
  /** Monto neto tras las correcciones vivas. */
  monto: number;
  moneda: string;
  glosa: string | null;
  categoriaId: string | null;
  etiquetaIds: string[];
  corregido: boolean;
  /**
   * Solo TRANSFERENCIA/CONVERSION: efecto neto sobre las cuentas que el actor
   * posee dentro del alcance (negativo = salió de sus cuentas, positivo = entró).
   * NULL para INGRESO/GASTO. No se suma a ningún total del período.
   */
  efectoPropio: number | null;
  /**
   * G39: la cuenta de donde salió la plata (impacto negativo) y a donde llegó
   * (impacto positivo); null si no hay. La app recuerda con esto la última
   * cuenta usada en cada puerta del "+".
   */
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  /** G39: cuándo se anotó (no la fecha del movimiento). */
  registradoEn: string;
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
