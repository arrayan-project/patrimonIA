/** G33, D-6 — recurrencia de movimientos programados (HZ-16). */
export const PERIODICIDADES = ['MENSUAL', 'ANUAL'] as const;
export type Periodicidad = (typeof PERIODICIDADES)[number];

/**
 * La ocurrencia que sigue a `fecha`: el mismo `dia` del mes siguiente (o del
 * mismo mes del año siguiente). Si el mes no tiene ese día, cae en el último
 * (31 → 30, 29-feb → 28-feb); `dia` no se pierde, así que vuelve al 31 después.
 */
export function siguienteFecha(fecha: Date, periodicidad: Periodicidad, dia: number): Date {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth() + (periodicidad === 'MENSUAL' ? 1 : 12);
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dia, ultimo)));
}

/** La fecha de hoy en Chile (YYYY-MM-DD): el aviso llega el día que dice, no a las 21:00 del anterior. */
export function hoyChile(ahora = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}
