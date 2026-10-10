/** Saldo con una persona (D-3): + te debe, − le debes. Lo entrega GET /usuarios/me/personas. */
export interface PersonaDTO {
  persona: string;
  moneda: string;
  saldo: number;
  deudaId: string | null;
  creditoId: string | null;
}

/** Respuesta de RegistrarPlataDeOtraPersona. */
export interface ResultadoPlataDTO extends PersonaDTO {
  eventoIds: string[];
  anuladoId: string | null;
}

/**
 * El saldo con una persona en palabras, sin signo ni color (D-8 §4.4):
 * "Noira te debe 5.000 CLP", "Le debes 30.000 CLP a Noira", "Noira y tú quedan a mano".
 * `formato` es `money` de `format.ts` (se recibe para poder probarlo con node --test).
 */
export function saldoTexto(
  persona: string,
  saldo: number,
  moneda: string,
  formato: (monto: number, moneda: string) => string,
): string {
  if (saldo > 0) return `${persona} te debe ${formato(saldo, moneda)}`;
  if (saldo < 0) return `Le debes ${formato(-saldo, moneda)} a ${persona}`;
  return `${persona} y tú quedan a mano`;
}

/**
 * HZ-20 — qué hacer con la plata que sale por una persona sin saldo:
 * ya la habías anotado como ingreso tuyo, no la anotaste o te la va a devolver.
 */
export type Previo = 'ANOTADA' | 'NO_ANOTADA' | 'DEVOLVER';

/**
 * El saldo que queda después de registrar (lo mismo que calcula el backend):
 * lo que entra lo baja, lo que sale lo sube; con HZ-20, la entrada previa lo
 * baja antes (por el monto del ingreso corregido o por el mismo monto).
 */
export function saldoResultante(
  saldo: number,
  direccion: 'ENTRA' | 'SALE',
  monto: number,
  previo?: { tipo: Previo; montoIngreso?: number },
): number {
  if (direccion === 'ENTRA') return saldo - monto;
  const entrada =
    previo?.tipo === 'ANOTADA' ? (previo.montoIngreso ?? 0) : previo?.tipo === 'NO_ANOTADA' ? monto : 0;
  return saldo - entrada + monto;
}

/**
 * La lista de "¿Quién?": un nombre por persona (aunque tenga saldo en varias
 * monedas) con su saldo en la moneda de la cuenta.
 */
export function opcionesDePersonas(
  personas: PersonaDTO[],
  moneda: string,
): { nombre: string; saldo: number }[] {
  const porNombre = new Map<string, { nombre: string; saldo: number }>();
  for (const p of personas) {
    const k = p.persona.toLocaleLowerCase('es');
    const actual = porNombre.get(k) ?? { nombre: p.persona, saldo: 0 };
    if (p.moneda === moneda) actual.saldo = p.saldo;
    porNombre.set(k, actual);
  }
  return [...porNombre.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * G39 (F-4, F-13): el saldo como lo diría el usuario, para la línea bajo
 * "¿De quién?" y el pie: "tienes 30.000 CLP de Noira" (su plata está en tu
 * cuenta), "Papás te debe 25.000 CLP", "Noira y tú quedan a mano".
 */
export function saldoClaro(
  persona: string,
  saldo: number,
  moneda: string,
  formato: (monto: number, moneda: string) => string,
): string {
  if (saldo < 0) return `tienes ${formato(-saldo, moneda)} de ${persona}`;
  if (saldo > 0) return `${persona} te debe ${formato(saldo, moneda)}`;
  return `${persona} y tú quedan a mano`;
}

/**
 * G39 (F-4): las personas para los botones de "¿De quién?": primero las que
 * tienen algo pendiente (la de más monto primero), después el resto por nombre.
 */
export function personasPrimero<T extends { nombre: string; saldo: number }>(personas: T[]): T[] {
  return [...personas].sort(
    (a, b) =>
      Number(b.saldo !== 0) - Number(a.saldo !== 0) ||
      Math.abs(b.saldo) - Math.abs(a.saldo) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}
