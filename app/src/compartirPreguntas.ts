/**
 * Bloque S (G45) — compartir una cuenta con el hogar en dos preguntas (y una
 * tercera solo para las del día a día), en vez de 4 niveles:
 *   🏠 ¿Esta plata es del hogar?            → participa_consolidacion
 *   👀 ¿[Nombre] puede ver los movimientos?  → visibilidad MOVIMIENTOS (solo si es del hogar)
 *   🔁 ¿Te pueden transferir a esta cuenta?  → visibilidad EXISTENCIA (solo si no es del hogar)
 * Se guarda en los mismos campos de siempre (sin migración). Equivalencias con
 * los 4 niveles de D-2: Nada = No · Que puedan transferirte = No + transferir
 * Sí · Que vean el saldo y sume = Sí + movimientos No · Todo = Sí + movimientos Sí.
 */
export type NivelVis = 'PRIVADA' | 'COMPARTIDA' | 'FAMILIAR';
export interface NivelesPorTipo {
  EXISTENCIA: NivelVis;
  VALOR: NivelVis;
  MOVIMIENTOS: NivelVis;
}

export interface Respuestas {
  hogar: boolean;
  movimientos: boolean;
  transferir: boolean;
}

/** Lo mínimo de una cuenta para leer sus respuestas. */
export interface CuentaCompartible {
  participaConsolidacion: boolean;
  visibilidad: string;
  visibilidadPorTipo?: Record<string, string> | null;
}

const nivelesDeCuenta = (el: CuentaCompartible): NivelesPorTipo =>
  (el.visibilidadPorTipo ?? {
    EXISTENCIA: el.visibilidad,
    VALOR: el.visibilidad,
    MOVIMIENTOS: el.visibilidad,
  }) as unknown as NivelesPorTipo;

/** Las respuestas que corresponden a cómo está hoy la cuenta. */
export function respuestasDe(el: CuentaCompartible): Respuestas {
  const v = nivelesDeCuenta(el);
  return {
    hogar: el.participaConsolidacion,
    movimientos: el.participaConsolidacion && v.MOVIMIENTOS !== 'PRIVADA',
    transferir: v.EXISTENCIA !== 'PRIVADA',
  };
}

/** Lo que se guarda para unas respuestas: la visibilidad por tipo y si suma al hogar. */
export function guardadoDe(r: Respuestas): { niveles: NivelesPorTipo; consolida: boolean } {
  if (r.hogar) {
    return {
      niveles: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: r.movimientos ? 'FAMILIAR' : 'PRIVADA' },
      consolida: true,
    };
  }
  return {
    niveles: { EXISTENCIA: r.transferir ? 'FAMILIAR' : 'PRIVADA', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' },
    consolida: false,
  };
}

/**
 * La cuenta tiene una combinación hecha en "Avanzado" que las preguntas no
 * pueden decir tal cual (p. ej. suma al hogar pero el saldo es privado): al
 * cambiar una respuesta, se reemplaza.
 */
export function esAMedida(el: CuentaCompartible): boolean {
  const g = guardadoDe(respuestasDe(el));
  const v = nivelesDeCuenta(el);
  return (
    g.consolida !== el.participaConsolidacion ||
    g.niveles.EXISTENCIA !== v.EXISTENCIA ||
    g.niveles.VALOR !== v.VALOR ||
    g.niveles.MOVIMIENTOS !== v.MOVIMIENTOS
  );
}

/**
 * La pregunta 🔁 va solo en las cuentas del día a día (G42: `cuentasDelDia`,
 * las elegidas en "Tu mes" o, si no elegiste, cuentas corrientes y tarjetas), y
 * siempre que ya esté en Sí (para poder apagarla). Nunca si es del hogar.
 */
export function preguntaTransferir(delDiaADia: boolean, r: Respuestas): boolean {
  if (r.hogar) return false;
  return r.transferir || delDiaADia;
}

/** "🏠 ¿Esta plata es del hogar?" — o deuda, o bien, según lo que sea. */
export function preguntaHogar(categoriaFuncional: string): string {
  if (categoriaFuncional === 'DEUDA') return '🏠 ¿Esta deuda es del hogar?';
  if (categoriaFuncional === 'ACTIVO') return '🏠 ¿Este bien es del hogar?';
  return '🏠 ¿Esta plata es del hogar?';
}

/** La respuesta corta, para una fila: "🏠 Del hogar · 🔒 movimientos privados". */
export function respuestaCorta(r: Respuestas): string {
  if (r.hogar) return r.movimientos ? '🏠 Del hogar · 👀 movimientos a la vista' : '🏠 Del hogar · 🔒 movimientos privados';
  return r.transferir ? '🙋 Solo tuya · 🔁 te pueden transferir' : '🙋 Solo tuya';
}

/** Una línea de la tarjeta "Así lo ve [Nombre]". */
export interface LineaAsiLoVe {
  emoji: string;
  texto: string;
}

/**
 * Lo que ve la otra persona con estas respuestas: el número, los movimientos
 * (o la línea 🔒) y si suma a "Plata del hogar". La tarjeta es la explicación.
 */
export function asiLoVe(
  r: Respuestas,
  cuenta: { nombre: string; saldo: string },
  yo: string,
): LineaAsiLoVe[] {
  if (r.hogar) {
    return [
      { emoji: '💰', texto: `Ve el saldo de ${cuenta.nombre}: ${cuenta.saldo}` },
      r.movimientos
        ? { emoji: '🧾', texto: 'Ve lo que entra y sale, con el detalle' }
        : { emoji: '🔒', texto: `Ve sus movimientos solo como "Movimientos privados de ${yo}"` },
      { emoji: '🏠', texto: 'Suma a "Plata del hogar"' },
    ];
  }
  return [
    r.transferir
      ? { emoji: '🔁', texto: `Ve que existe ${cuenta.nombre} y puede transferirte; no ve el saldo` }
      : { emoji: '🙈', texto: `No ve ${cuenta.nombre}` },
    { emoji: '🧾', texto: 'No ve sus movimientos' },
    { emoji: '🙋', texto: 'No suma a "Plata del hogar"' },
  ];
}
