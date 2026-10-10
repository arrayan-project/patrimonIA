/**
 * G41/G42 — la foto del mes de tus cuentas del día a día. Lo que entró y lo que
 * salió, agrupado para que se vea que cuadra:
 *   Tenías al empezar + Entró − Salió = Tienes.
 * "Entró" y "Salió" son los mismos números en el Inicio y en Movimientos.
 */
import type { LineaFotoMesDTO } from './api/client';

/** Lo mínimo de una cuenta para elegir las del día a día. */
export interface CuentaParaElegir {
  id: string;
  tipo: string;
  categoriaFuncional: string;
  estado: string;
  naturaleza?: string | null;
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esTarjeta = (e: CuentaParaElegir) => e.categoriaFuncional === 'DEUDA' && sinTildes(e.tipo).includes('tarjeta');

/** Las que se pueden elegir: tus cuentas, ahorros, tarjetas y créditos activos (no casas ni autos). */
export function elegiblesDelDia<T extends CuentaParaElegir>(els: T[]): T[] {
  return els.filter(
    (e) => e.estado === 'ACTIVO' && e.categoriaFuncional !== 'ACTIVO' && e.naturaleza !== 'CUSTODIA_INFORMAL',
  );
}

/**
 * Las cuentas del día a día: las que elegiste (si siguen activas) o, si no
 * elegiste, tus cuentas corrientes/vista/efectivo y tus tarjetas.
 */
export function cuentasDelDia(els: CuentaParaElegir[], elegidas: string[] | null): string[] {
  const posibles = elegiblesDelDia(els);
  if (elegidas) return posibles.filter((e) => elegidas.includes(e.id)).map((e) => e.id);
  return posibles.filter((e) => e.categoriaFuncional === 'LIQUIDEZ' || esTarjeta(e)).map((e) => e.id);
}

/** Cómo se dice cada línea, con su emoji. */
export function rotuloLinea(l: LineaFotoMesDTO): string {
  const entra = l.monto > 0;
  switch (l.clase) {
    case 'INGRESO':
      return '💰 Recibiste';
    case 'GASTO':
      return entra ? '💸 Te devolvieron' : '💸 Gastaste';
    case 'SALDO_INICIAL':
      return '🆕 Cuentas que agregaste';
    case 'AHORRO':
      return entra ? '🐷 Sacaste de tus ahorros' : '🐷 Ahorraste';
    case 'INVERSION':
      return entra ? '📈 Sacaste de tus inversiones' : '📈 Invertiste';
    case 'DEUDA':
      return entra ? '💳 Te prestaron' : '💳 Pagaste deudas';
    case 'CUSTODIA':
      return entra ? '👥 Te encargaron plata' : '👥 Entregaste plata encargada';
    case 'PERSONA':
      return entra ? `👤 Te pasó ${l.persona?.nombre ?? 'alguien'}` : `👤 Le pasaste a ${l.persona?.nombre ?? 'alguien'}`;
    case 'CAMBIO_MONEDA':
      return '💱 Cambiaste de moneda';
    case 'AJUSTE':
      return '✏️ Corregiste el saldo';
    default:
      return entra ? '🔁 Trajiste de tus otras cuentas' : '🔁 Pasaste a tus otras cuentas';
  }
}

export interface FotoAgrupada {
  entro: number;
  salio: number;
  lineasEntro: LineaFotoMesDTO[];
  lineasSalio: LineaFotoMesDTO[];
}

/** Entró (positivas) y salió (negativas, en positivo), de mayor a menor. */
export function agruparFoto(lineas: LineaFotoMesDTO[]): FotoAgrupada {
  const lineasEntro = lineas.filter((l) => l.monto > 0).sort((a, b) => b.monto - a.monto);
  const lineasSalio = lineas.filter((l) => l.monto < 0).sort((a, b) => a.monto - b.monto);
  return {
    entro: lineasEntro.reduce((s, l) => s + l.monto, 0),
    salio: -lineasSalio.reduce((s, l) => s + l.monto, 0),
    lineasEntro,
    lineasSalio,
  };
}
