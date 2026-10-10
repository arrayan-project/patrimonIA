/**
 * G43 — el mes que no parte el día 1. Mucha gente vive el mes desde que le
 * llega el sueldo (p. ej. del 25 al 24). Con `dia` > 1, el mes "noviembre" es:
 *   - nombre 'termina' (por defecto, el mes que vives): 25 oct – 24 nov.
 *   - nombre 'empieza' (el mes del sueldo):            25 nov – 24 dic.
 * Si el día de inicio cae sábado o domingo, el mes parte el viernes anterior
 * (el sueldo se paga antes). Con `dia` = 1 es el mes calendario, sin correr.
 */
export type NombreMes = 'termina' | 'empieza';

export interface CicloMes {
  /** 1–28. */
  dia: number;
  nombre: NombreMes;
}

export const CICLO_CALENDARIO: CicloMes = { dia: 1, nombre: 'termina' };

export const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha ISO local (sin hora). */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Primer día del mes `mes` (0-11) de `anio`, según el ciclo. */
export function inicioCiclo(anio: number, mes: number, c: CicloMes): Date {
  if (c.dia <= 1) return new Date(anio, mes, 1);
  const d = new Date(anio, c.nombre === 'termina' ? mes - 1 : mes, c.dia);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  else if (dow === 0) d.setDate(d.getDate() - 2);
  return d;
}

/** Ventana [desde, hasta] (ISO) del mes `mes` (0-11) de `anio`. */
export function ventanaCiclo(anio: number, mes: number, c: CicloMes): { desde: string; hasta: string } {
  const hasta = inicioCiclo(anio, mes + 1, c);
  hasta.setDate(hasta.getDate() - 1);
  return { desde: isoLocal(inicioCiclo(anio, mes, c)), hasta: isoLocal(hasta) };
}

/** El mes (año, 0-11) del ciclo en que cae `fecha`. */
export function cicloDe(fecha: Date, c: CicloMes): { anio: number; mes: number } {
  const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // El candidato es el mes calendario o uno de sus vecinos.
  for (const delta of [1, 0, -1]) {
    const f = new Date(dia.getFullYear(), dia.getMonth() + delta, 1);
    if (inicioCiclo(f.getFullYear(), f.getMonth(), c) <= dia) return { anio: f.getFullYear(), mes: f.getMonth() };
  }
  return { anio: dia.getFullYear(), mes: dia.getMonth() - 2 };
}

/** "25 oct – 24 nov"; null con el mes calendario (no hace falta decirlo). */
export function rotuloCiclo(anio: number, mes: number, c: CicloMes): string | null {
  if (c.dia <= 1) return null;
  const { desde, hasta } = ventanaCiclo(anio, mes, c);
  const corto = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES_CORTO[Number(iso.slice(5, 7)) - 1]}`;
  return `${corto(desde)} – ${corto(hasta)}`;
}
