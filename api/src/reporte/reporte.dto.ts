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
  /**
   * Solo TRANSFERENCIA/CONVERSION con una cuenta fuera del alcance: el dueño de
   * esa cuenta (p. ej. el otro miembro del hogar al que le pasaste plata). Null
   * si la plata se movió entre cuentas del alcance.
   */
  contraparte: { usuarioId: string; nombre: string } | null;
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

/**
 * G41 — qué movió la plata de un grupo de cuentas en el período. `clase`:
 *   INGRESO · GASTO · SALDO_INICIAL (cuenta que se agregó) ·
 *   AHORRO (con tus cuentas de ahorro) · INVERSION · DEUDA (pagos o créditos) ·
 *   CUSTODIA (plata de otras personas que guardas, G28) ·
 *   OTRAS (con tus otras cuentas) · PERSONA (con alguien del hogar) ·
 *   CAMBIO_MONEDA (entre tus cuentas de distinta moneda) · AJUSTE (corregiste el saldo).
 * `monto` con signo: positivo = entró a las cuentas; negativo = salió.
 * Una línea por (clase, signo, persona): lo que entra y lo que sale no se netean.
 */
export interface LineaFotoMesDTO {
  clase: string;
  monto: number;
  persona: { usuarioId: string; nombre: string } | null;
}

export interface FotoMesPorMonedaDTO {
  moneda: string;
  /** Lo que había en las cuentas el día antes de `desde`. */
  tenias: number;
  /** Lo que había al cierre de `hasta`. tenias + Σ lineas = tienes. */
  tienes: number;
  lineas: LineaFotoMesDTO[];
  /** Lo apartado hoy para metas en estas cuentas (reservas activas). */
  apartadoMetas: number;
}

export interface FotoMesDTO {
  periodo: { desde: string; hasta: string };
  /** Las cuentas usadas (las pedidas que son tuyas y están activas). */
  cuentas: string[];
  porMoneda: FotoMesPorMonedaDTO[];
}
