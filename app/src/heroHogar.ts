import type { PatrimonioConsolidadoDTO } from './api/client';

/**
 * Qué muestra el Hero del Inicio en la vista "Del hogar" (G33, BUG-HOG).
 * Un total de 0 falso es peor que un error explícito: si la consulta falla o
 * no hay dato, se informa; si falta un tipo de cambio, se usa la moneda del
 * hogar (nunca la primera moneda que venga en la respuesta).
 */
export type HeroHogar =
  | { tipo: 'total'; monto: number; moneda: string }
  | { tipo: 'parcial'; monto: number; moneda: string; faltantes: string[] }
  | { tipo: 'error'; mensaje: string };

export function heroHogar(
  consolidado: PatrimonioConsolidadoDTO | null,
  errorCarga: string | null,
  monedaHogar: string,
): HeroHogar {
  if (errorCarga) {
    return { tipo: 'error', mensaje: `No se pudo cargar el patrimonio del hogar: ${errorCarga}` };
  }
  if (!consolidado) {
    return { tipo: 'error', mensaje: 'No se pudo cargar el patrimonio del hogar.' };
  }
  if (consolidado.total != null) {
    return { tipo: 'total', monto: consolidado.total, moneda: consolidado.monedaConsolidacion };
  }
  const faltantes = consolidado.conversionesFaltantes;
  const propia = consolidado.porMoneda.find((m) => m.moneda === monedaHogar);
  if (propia) {
    return { tipo: 'parcial', monto: propia.patrimonioNeto, moneda: monedaHogar, faltantes };
  }
  return {
    tipo: 'error',
    mensaje: `No se puede calcular el total en ${monedaHogar}: falta tipo de cambio para ${faltantes.join(', ')}.`,
  };
}
