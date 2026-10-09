import { MovimientosScreen } from './MovimientosScreen';

/**
 * "Movimientos del hogar" abierto desde el Hogar (G35): es la pestaña
 * Movimientos en "Del hogar", encima y con atrás, para que haya una sola
 * versión de esa lista y sus cifras cuadren con la pestaña.
 */
export function MovimientosHogarScreen() {
  return <MovimientosScreen soloHogar />;
}
