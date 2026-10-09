import type { CategoriaMovimientoDTO } from './api/client';

/**
 * G35: emojis para reconocer cada cosa de un vistazo. Cada usuario puede
 * cambiar el de sus cuentas y metas (preferencias) y el hogar el de sus
 * categorías (`categoria_movimiento.icono`); estos son los de por defecto.
 */

/** Por categoría funcional de la cuenta o bien. */
export const EMOJI_CATEGORIA_FUNCIONAL: Record<string, string> = {
  LIQUIDEZ: '🏦',
  RESERVA: '🐷',
  INVERSION: '📈',
  ACTIVO: '🏠',
  CREDITO: '🤝',
  DEUDA: '💳',
};

export const EMOJI_META = '🎯';

/** Por nombre de las categorías que se crean con el hogar (y nombres comunes). */
const EMOJI_POR_NOMBRE: Record<string, string> = {
  sueldo: '💼',
  'otros ingresos': '💰',
  mercado: '🛒',
  supermercado: '🛒',
  vivienda: '🏠',
  arriendo: '🏠',
  servicios: '💡',
  luz: '💡',
  agua: '💧',
  gas: '🔥',
  internet: '🌐',
  telefono: '📱',
  transporte: '🚗',
  bencina: '⛽',
  salud: '🩺',
  farmacia: '💊',
  educacion: '📚',
  restaurantes: '🍽️',
  comida: '🍽️',
  ocio: '🎉',
  viajes: '✈️',
  mascotas: '🐶',
  ropa: '👕',
  regalos: '🎁',
  'otros gastos': '📦',
};

const sinTildes = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Emoji de una categoría de movimiento: el elegido, o uno por su nombre, o 🏷️. */
export function emojiCategoria(cat: Pick<CategoriaMovimientoDTO, 'nombre' | 'icono'> | null | undefined): string | null {
  if (!cat) return null;
  if (cat.icono && !/^[a-z-]+$/.test(cat.icono)) return cat.icono;
  return EMOJI_POR_NOMBRE[sinTildes(cat.nombre)] ?? '🏷️';
}

/** Emoji de un movimiento sin categoría, según su tipo. */
export function emojiTipoMovimiento(tipo: string): string {
  switch (tipo) {
    case 'INGRESO':
      return '💰';
    case 'GASTO':
      return '🧾';
    case 'TRANSFERENCIA':
      return '🔁';
    case 'CONVERSION':
      return '💱';
    case 'SALDO_INICIAL':
      return '🏁';
    default:
      return '🧾';
  }
}

/** Emoji de una cuenta o bien: el que eligió el usuario o el de su categoría. */
export function emojiElemento(
  el: { id: string; categoriaFuncional: string },
  elegidos: Record<string, string>,
): string {
  return elegidos[el.id] ?? EMOJI_CATEGORIA_FUNCIONAL[el.categoriaFuncional] ?? '💼';
}

/** Emoji de una meta: el que eligió el usuario o 🎯. */
export function emojiMeta(id: string, elegidos: Record<string, string>): string {
  return elegidos[id] ?? EMOJI_META;
}
