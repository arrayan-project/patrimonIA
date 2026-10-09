import type { ElementoPatrimonialDTO } from './api/client';
import { emojiElemento } from './emojis';
import { money } from './format';
import type { OpcionSelect } from './ui';

/** HZ-17: grupos de "Desde qué cuenta" / "A qué cuenta", en este orden. */
const GRUPOS: [string, string][] = [
  ['LIQUIDEZ', 'Cuentas'],
  ['RESERVA', 'Ahorro'],
  ['INVERSION', 'Inversiones'],
  ['ACTIVO', 'Bienes'],
  ['DEUDA', 'Deudas'],
  ['CREDITO', 'Te deben'],
];

/**
 * Elementos propios como opciones agrupadas por tipo. El nombre va en la
 * etiqueta y, en la segunda línea, el valor vigente (con `saldo`) o la moneda. `excluir` saca un id (p. ej. la
 * cuenta ya elegida en "Desde", para que no aparezca otra vez en "A qué cuenta").
 * Con `emojis` (los elegidos por el usuario), cada opción lleva el emoji de la cuenta (G35).
 */
export function opcionesDeElementos(
  els: ElementoPatrimonialDTO[],
  {
    saldo = true,
    excluir,
    emojis,
  }: { saldo?: boolean; excluir?: string | null; emojis?: Record<string, string> } = {},
): OpcionSelect[] {
  const orden = (cat: string) => {
    const i = GRUPOS.findIndex(([k]) => k === cat);
    return i === -1 ? GRUPOS.length : i;
  };
  return els
    .filter((e) => e.id !== excluir)
    .sort((a, b) => orden(a.categoriaFuncional) - orden(b.categoriaFuncional))
    .map((e) => ({
      value: e.id,
      label: e.nombre,
      sub: saldo ? money(e.valorVigente, e.moneda) : e.moneda,
      grupo: GRUPOS.find(([k]) => k === e.categoriaFuncional)?.[1] ?? 'Otros',
      ...(emojis ? { emoji: emojiElemento(e, emojis) } : {}),
    }));
}

/** Cuentas de otros miembros del hogar, agrupadas por persona (destino = persona). */
export function opcionesDeMiembros(
  els: ElementoPatrimonialDTO[],
  { excluir, emojis }: { excluir?: string | null; emojis?: Record<string, string> } = {},
): OpcionSelect[] {
  return els
    .filter((e) => e.id !== excluir)
    .map((e) => ({
      value: e.id,
      label: e.nombre,
      sub: e.valorOculto ? undefined : money(e.valorVigente, e.moneda),
      grupo: `Cuentas de ${e.propietarios[0]?.nombre ?? 'otro miembro'}`,
      ...(emojis ? { emoji: emojiElemento(e, emojis) } : {}),
    }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo));
}
