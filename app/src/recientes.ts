/**
 * G39 (F-1, F-2): lo que el formulario de Gasté / Recibí / Moví plata recuerda
 * de los últimos movimientos: la cuenta de la última vez y las categorías más
 * usadas. Sale del resumen de los últimos días (`/usuarios/me/resumen-financiero`),
 * sin guardar nada nuevo: es igual en todos los teléfonos.
 */

/** Lo que se usa de cada movimiento del resumen. */
export interface MovimientoReciente {
  tipo: string;
  categoriaId: string | null;
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  registradoEn: string;
}

export type Puerta = 'GASTO' | 'INGRESO' | 'TRANSFERENCIA';

/** Días hacia atrás que se miran. */
export const DIAS_RECIENTES = 90;

/** Moví plata recuerda también los cambios de moneda (son la misma puerta). */
function esDePuerta(tipo: string, puerta: Puerta): boolean {
  return puerta === 'TRANSFERENCIA' ? tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION' : tipo === puerta;
}

const masNuevoPrimero = (a: MovimientoReciente, b: MovimientoReciente) =>
  a.registradoEn < b.registradoEn ? 1 : a.registradoEn > b.registradoEn ? -1 : 0;

/**
 * La cuenta (o el par de cuentas, en Moví plata) del último movimiento anotado
 * de esa puerta. Solo cuentas que el formulario ofrece en ese lado (`valida`:
 * la de salida tiene que ser tuya; la de llegada, en Moví plata, puede ser de
 * alguien del hogar); si la última vez usó una que ya no está, se busca la
 * anterior. null si no hay.
 */
export function ultimaCuenta(
  movs: MovimientoReciente[],
  puerta: Puerta,
  valida: (id: string, lado: 'origen' | 'destino') => boolean,
): { origenId: string | null; destinoId: string | null } | null {
  const ok = (id: string | null, lado: 'origen' | 'destino'): id is string => !!id && valida(id, lado);
  for (const m of [...movs].sort(masNuevoPrimero)) {
    if (!esDePuerta(m.tipo, puerta)) continue;
    if (puerta === 'GASTO' && ok(m.elementoOrigenId, 'origen')) return { origenId: m.elementoOrigenId, destinoId: null };
    if (puerta === 'INGRESO' && ok(m.elementoDestinoId, 'destino')) return { origenId: null, destinoId: m.elementoDestinoId };
    if (
      puerta === 'TRANSFERENCIA' &&
      ok(m.elementoOrigenId, 'origen') &&
      ok(m.elementoDestinoId, 'destino') &&
      m.elementoOrigenId !== m.elementoDestinoId
    )
      return { origenId: m.elementoOrigenId, destinoId: m.elementoDestinoId };
  }
  return null;
}

/**
 * Las categorías más usadas en esa puerta (solo Gasté y Recibí), de la más
 * usada a la menos; a igual uso, la usada más recientemente primero. Solo las
 * que el formulario ofrece (`valida`).
 */
export function categoriasMasUsadas(
  movs: MovimientoReciente[],
  puerta: 'GASTO' | 'INGRESO',
  valida: (id: string) => boolean,
  cuantas = 4,
): string[] {
  const usos = new Map<string, { n: number; ultima: string }>();
  for (const m of movs) {
    if (m.tipo !== puerta || !m.categoriaId || !valida(m.categoriaId)) continue;
    const u = usos.get(m.categoriaId);
    if (u) {
      u.n += 1;
      if (m.registradoEn > u.ultima) u.ultima = m.registradoEn;
    } else usos.set(m.categoriaId, { n: 1, ultima: m.registradoEn });
  }
  return [...usos.entries()]
    .sort(([, a], [, b]) => b.n - a.n || (a.ultima < b.ultima ? 1 : a.ultima > b.ultima ? -1 : 0))
    .slice(0, cuantas)
    .map(([id]) => id);
}
