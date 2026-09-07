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
  porMoneda: ConsolidadoPorMoneda[];
  elementos: number;
  miembros: number;
  /**
   * Patrimonio neto total convertido a `monedaConsolidacion` con los tipos de
   * cambio vigentes hoy. null si falta alguna tasa (ver `conversionesFaltantes`).
   */
  total: number | null;
  conversionesFaltantes: string[];
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
  glosa: string | null;
  /**
   * Elementos afectados (para una transferencia: origen y destino). Solo se
   * incluyen los que el actor puede ver en el hogar — `participa_consolidacion`
   * o de su propiedad. Ver `ConsolidacionService.eventosDelHogar`.
   */
  elementos: { id: string; nombre: string }[];
}
