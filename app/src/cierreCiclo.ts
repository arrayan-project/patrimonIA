/**
 * L-8 (S04) — tarjeta de cierre del ciclo: al empezar un ciclo nuevo, el
 * Inicio ("Lo mío") pregunta qué hacer con lo que sobró del anterior.
 * Funciones puras (sin imports) para poder testearlas con node --test.
 */

/** Días del ciclo en que se muestra la tarjeta (el día 1 es el primero). */
export const DIAS_CIERRE = 7;

/** Clave del ciclo para recordar que ya se vio: `AAAA-MM` (mes 0–11 → 01–12). */
export function claveCiclo(anio: number, mes: number): string {
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

/** El ciclo anterior (mes 0–11). */
export function cicloAnterior(anio: number, mes: number): { anio: number; mes: number } {
  return mes === 0 ? { anio: anio - 1, mes: 11 } : { anio, mes: mes - 1 };
}

const dia = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** ¿Estamos en los primeros `DIAS_CIERRE` días del ciclo que parte en `desdeISO`? */
export function enDiasDeCierre(hoyISO: string, desdeISO: string): boolean {
  const n = Math.round((dia(hoyISO) - dia(desdeISO)) / 86_400_000);
  return n >= 0 && n < DIAS_CIERRE;
}

/**
 * Se muestra si: estamos en los primeros 7 días del ciclo, en el ciclo
 * anterior Entró − Salió > 0, y no se tocó ya para este ciclo (`cierreVisto`).
 */
export function mostrarCierre(p: {
  hoyISO: string;
  desdeISO: string;
  sobrante: number;
  clave: string;
  cierreVisto: string | null;
}): boolean {
  return enDiasDeCierre(p.hoyISO, p.desdeISO) && p.sobrante > 0 && p.cierreVisto !== p.clave;
}
