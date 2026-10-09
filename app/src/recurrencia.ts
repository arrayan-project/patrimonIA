/** G33, D-6 — recurrencia de movimientos programados (HZ-16). */
export type Periodicidad = 'MENSUAL' | 'ANUAL';

/** "¿Se repite?": No · Cada mes · Cada año. */
export const OPCIONES_REPITE = [
  { value: 'NO', label: 'No' },
  { value: 'MENSUAL', label: 'Cada mes' },
  { value: 'ANUAL', label: 'Cada año' },
];

/**
 * La fecha (YYYY-MM-DD) que sigue a `fecha`: el mismo día del mes siguiente (o
 * del mismo mes del año siguiente); si el mes no tiene ese día, cae en el
 * último. Igual que `siguienteFecha` del backend.
 */
export function siguienteFecha(fecha: string, periodicidad: Periodicidad): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const mes = m - 1 + (periodicidad === 'MENSUAL' ? 1 : 12);
  const ultimo = new Date(Date.UTC(y, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mes, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** "cada mes" / "cada año", para el subtítulo de una lista. */
export function etiquetaRepite(periodicidad: Periodicidad): string {
  return periodicidad === 'MENSUAL' ? 'cada mes' : 'cada año';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "el 5 de cada mes" / "cada 5 de marzo", a partir del día pedido y una fecha de la serie. */
export function cadaCuando(periodicidad: Periodicidad, fecha: string, dia?: number | null): string {
  const d = dia ?? Number(fecha.slice(8, 10));
  return periodicidad === 'MENSUAL' ? `el ${d} de cada mes` : `cada ${d} de ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
}
