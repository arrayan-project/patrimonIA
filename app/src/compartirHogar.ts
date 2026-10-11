import { api } from './api/client';
import { guardadoDe, type Respuestas } from './compartirPreguntas';

/**
 * Bloque S (G45) — qué compartes de una cuenta con el hogar, en preguntas
 * (compartirPreguntas.ts). Reemplaza los 4 niveles de D-2; se guarda en los
 * mismos campos: la visibilidad por tipo de información (§M) y si la cuenta
 * suma al patrimonio del hogar. El dominio sigue separando las dos ideas.
 */

/**
 * Lo que se envía en el alta: no es del hogar, pero te pueden transferir
 * (D-2: "Que puedan transferirte" por defecto). Después del alta, las
 * preguntas lo cambian si hace falta.
 */
export const altaPorDefecto = () => {
  const g = guardadoDe({ hogar: false, movimientos: false, transferir: true });
  return { visibilidadPorTipo: g.niveles, participaConsolidacion: g.consolida };
};

/**
 * Guarda las respuestas con los dos comandos de siempre: la visibilidad por
 * tipo y, si cambia, si suma al hogar.
 */
export async function aplicarRespuestas(
  token: string,
  elementoId: string,
  r: Respuestas,
  consolidaAntes: boolean,
): Promise<void> {
  const g = guardadoDe(r);
  await api.post(
    '/comandos/DefinirVisibilidadElementoPatrimonial',
    { elementoId, niveles: g.niveles, compartidoCon: [] },
    token,
  );
  if (g.consolida !== consolidaAntes) {
    await api.post('/comandos/CambiarParticipacionEnConsolidacion', { elementoId, participa: g.consolida }, token);
  }
}
