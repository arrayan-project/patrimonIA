export function money(monto: number, moneda: string): string {
  const abs = Math.abs(monto).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${monto < 0 ? '-' : ''}${abs} ${moneda}`;
}

/** G35: un porcentaje con coma decimal y a lo más un decimal ("3,8%"). */
export function porcentaje(n: number): string {
  return `${String(Math.round(n * 10) / 10).replace('.', ',')}%`;
}

/**
 * G35: cuánto falta para una fecha ('YYYY-MM-DD'), en palabras: "Faltan 12
 * días", "Faltan 3 meses", "Faltan 10 años"; "Vence hoy" o "Venció".
 */
export function cuantoFalta(fecha: string, hoy: Date = new Date()): string {
  const d = Math.round((new Date(`${fecha.slice(0, 10)}T12:00:00`).getTime() - hoy.getTime()) / 86_400_000);
  if (d < 0) return 'Venció';
  if (d === 0) return 'Vence hoy';
  const [n, unidad] =
    d < 60 ? [d, d === 1 ? 'día' : 'días'] : d < 730 ? [Math.round(d / 30.44), 'meses'] : [Math.round(d / 365.25), 'años'];
  return `${n === 1 ? 'Falta' : 'Faltan'} ${n} ${unidad}`;
}
