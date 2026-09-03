export interface ConsolidadoPorMoneda {
  moneda: string;
  patrimonioNeto: number;
  activos: number;
  pasivos: number;
  valorLiquido: number;
}

export interface PatrimonioConsolidadoDTO {
  hogarId: string;
  monedaConsolidacion: string;
  /** Sin total único entre monedas: requiere tipos de cambio (GAPS.md G7). */
  porMoneda: ConsolidadoPorMoneda[];
  elementos: number;
  miembros: number;
}

export interface DistribucionCategoria {
  categoria: string;
  valor: number;
  porcentaje: number;
}

export interface MetricasPorMoneda {
  moneda: string;
  patrimonioNeto: number;
  activos: number;
  pasivos: number;
  /** valorLiquido / activos, en [0, 1]. null si no hay activos. */
  liquidez: number | null;
  distribucionPorActivo: DistribucionCategoria[];
  distribucionPorPasivo: DistribucionCategoria[];
}

export interface MetricasHogarDTO {
  hogarId: string;
  porMoneda: MetricasPorMoneda[];
  objetivos: {
    total: number;
    enProgreso: number;
    completados: number;
    montoObjetivoTotal: number;
    progresoTotal: number;
    avancePorcentaje: number | null;
  };
}

export interface EventoConsolidadoDTO {
  eventoId: string;
  tipo: string;
  fecha: string;
  moneda: string;
  /** Monto neto tras aplicar correcciones vivas. */
  montoEfectivo: number;
  anulado: boolean;
  corregido: boolean;
  elementos: string[];
}
