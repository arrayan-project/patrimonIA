export function money(monto: number, moneda: string): string {
  const abs = Math.abs(monto).toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${monto < 0 ? '-' : ''}${abs} ${moneda}`;
}
