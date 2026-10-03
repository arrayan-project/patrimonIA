import { api, type ElementoPatrimonialDTO } from './api/client';
import type { OpcionSelect } from './ui';

/**
 * D-2 — "¿Qué compartes de esta cuenta con el hogar?": una pregunta con 4
 * niveles que fija a la vez la visibilidad por tipo de información (§M) y si
 * la cuenta suma al patrimonio del hogar. El dominio sigue separando las dos
 * ideas; las combinaciones que no calzan con un nivel son "Personalizado" y se
 * editan en "Avanzado".
 */
export type NivelHogar = 'nada' | 'transferir' | 'saldo' | 'todo';

type Niveles = { EXISTENCIA: string; VALOR: string; MOVIMIENTOS: string };

const DEF: Record<NivelHogar, { niveles: Niveles; consolida: boolean }> = {
  nada: { niveles: { EXISTENCIA: 'PRIVADA', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' }, consolida: false },
  transferir: { niveles: { EXISTENCIA: 'FAMILIAR', VALOR: 'PRIVADA', MOVIMIENTOS: 'PRIVADA' }, consolida: false },
  saldo: { niveles: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'PRIVADA' }, consolida: true },
  todo: { niveles: { EXISTENCIA: 'FAMILIAR', VALOR: 'FAMILIAR', MOVIMIENTOS: 'FAMILIAR' }, consolida: true },
};

/** Nivel por defecto al crear (D-2). */
export const NIVEL_POR_DEFECTO: NivelHogar = 'transferir';

/** Lo que se envía en el alta para el nivel por defecto. */
export const altaPorDefecto = () => ({
  visibilidadPorTipo: DEF[NIVEL_POR_DEFECTO].niveles,
  participaConsolidacion: DEF[NIVEL_POR_DEFECTO].consolida,
});

/** Las 4 opciones; `pareja` personaliza el texto si el hogar tiene un solo otro miembro. */
export function opcionesNivel(pareja?: string): OpcionSelect[] {
  const ven = pareja ? 'Ve' : 'Ven';
  return [
    { value: 'nada', label: 'Nada', sub: 'Solo tú la ves.' },
    {
      value: 'transferir',
      label: pareja ? `Que ${pareja} pueda transferirte` : 'Que puedan transferirte',
      sub: `${ven} el nombre de la cuenta, no cuánto tiene.`,
    },
    {
      value: 'saldo',
      label: pareja ? `Que ${pareja} vea el saldo y sume al hogar` : 'Que vean el saldo y sume al hogar',
      sub: 'Cuenta en el total de la plata del hogar.',
    },
    { value: 'todo', label: 'Todo, también los movimientos', sub: `${ven} el saldo y lo que entra y sale.` },
  ];
}

/** El nivel que corresponde a la configuración actual, o 'personalizado'. */
export function nivelDe(el: ElementoPatrimonialDTO): NivelHogar | 'personalizado' {
  const vpt = el.visibilidadPorTipo ?? {
    EXISTENCIA: el.visibilidad,
    VALOR: el.visibilidad,
    MOVIMIENTOS: el.visibilidad,
  };
  const n = (Object.keys(DEF) as NivelHogar[]).find(
    (k) =>
      DEF[k].consolida === el.participaConsolidacion &&
      DEF[k].niveles.EXISTENCIA === vpt.EXISTENCIA &&
      DEF[k].niveles.VALOR === vpt.VALOR &&
      DEF[k].niveles.MOVIMIENTOS === vpt.MOVIMIENTOS,
  );
  return n ?? 'personalizado';
}

/**
 * Aplica un nivel: define la visibilidad y, si cambia, la participación en el
 * patrimonio del hogar. Son dos comandos existentes (sin dominio nuevo).
 */
export async function aplicarNivel(
  token: string,
  elementoId: string,
  nivel: NivelHogar,
  consolidaAntes: boolean,
): Promise<void> {
  const d = DEF[nivel];
  await api.post(
    '/comandos/DefinirVisibilidadElementoPatrimonial',
    { elementoId, niveles: d.niveles, compartidoCon: [] },
    token,
  );
  if (d.consolida !== consolidaAntes) {
    await api.post(
      '/comandos/CambiarParticipacionEnConsolidacion',
      { elementoId, participa: d.consolida },
      token,
    );
  }
}

/** Texto corto del nivel actual, para el detalle de la cuenta. */
export function etiquetaNivel(el: ElementoPatrimonialDTO): string {
  return {
    nada: 'Nada',
    transferir: 'Pueden transferirte',
    saldo: 'Ven el saldo y suma al hogar',
    todo: 'Todo, también los movimientos',
    personalizado: 'Personalizado',
  }[nivelDe(el)];
}
