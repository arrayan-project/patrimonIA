/**
 * G39 (claridad, Juan 2026-10-10): la plata que le pasas a otra persona del
 * hogar (o que te pasa) no es gasto ni ingreso, pero sale (o entra) de lo
 * tuyo. El resumen del mes la muestra en una línea por persona y la cuenta en
 * "Te queda del mes", así cuadra con lo que se movió de tus cuentas.
 */
export interface MovimientoConPersona {
  tipo: string;
  moneda: string;
  efectoPropio: number | null;
  contraparte: { usuarioId: string; nombre: string } | null;
}

/** Monto con signo: negativo = le pasaste; positivo = te pasó. */
export interface PaseConPersona {
  usuarioId: string;
  nombre: string;
  monto: number;
}

/** Lo que pasaste y te pasaron en el período, por persona y dirección (primero lo que salió). */
export function pasesConPersonas(movs: MovimientoConPersona[], moneda: string): PaseConPersona[] {
  const acc = new Map<string, PaseConPersona>();
  for (const m of movs) {
    if (m.tipo !== 'TRANSFERENCIA' || !m.contraparte || m.moneda !== moneda) continue;
    const e = m.efectoPropio ?? 0;
    if (e === 0) continue;
    const clave = `${m.contraparte.usuarioId}:${e < 0 ? 'sale' : 'entra'}`;
    const prev = acc.get(clave);
    acc.set(clave, { usuarioId: m.contraparte.usuarioId, nombre: m.contraparte.nombre, monto: (prev?.monto ?? 0) + e });
  }
  return [...acc.values()].sort((a, b) => a.monto - b.monto);
}

/** G45 H2: lo que entró al hogar o salió de él, por persona, en el resumen "Del hogar". */
export interface AporteHogar {
  usuarioId: string;
  nombre: string;
  moneda: string;
  entro: number;
  salio: number;
}

/**
 * G45 H2 — en "Del hogar", los aportes (de una cuenta que no suma a una que
 * suma) y las salidas se cuentan como los pases de "Lo mío": una línea por
 * persona y dirección, y entran en "Les queda" (primero lo que salió).
 */
export function aportesComoPases(aportes: AporteHogar[], moneda: string): PaseConPersona[] {
  const out: PaseConPersona[] = [];
  for (const a of aportes) {
    if (a.moneda !== moneda) continue;
    if (a.salio > 0) out.push({ usuarioId: a.usuarioId, nombre: a.nombre, monto: -a.salio });
    if (a.entro > 0) out.push({ usuarioId: a.usuarioId, nombre: a.nombre, monto: a.entro });
  }
  return out.sort((x, y) => x.monto - y.monto);
}

/** Entró − gastaste ± lo pasado con personas del hogar. */
export function quedaDelMes(ingresos: number, gastos: number, pases: PaseConPersona[]): number {
  return ingresos - gastos + pases.reduce((s, p) => s + p.monto, 0);
}
