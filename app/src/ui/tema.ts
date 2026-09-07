import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { guardar, leer } from '../auth/secureStorage';

/** Colores semánticos de la app. Mismas claves en claro y oscuro. */
export interface Paleta {
  /** Fondo de la página. */
  fondo: string;
  /** Fondo de tarjetas, inputs y modales. */
  bg: string;
  text: string;
  /** Texto secundario. */
  muted: string;
  /** Texto terciario (fechas, pies de fila, unidades). Más tenue que `muted`. */
  mutedDim: string;
  border: string;
  /** Acento monocromo — casi blanco en oscuro, casi negro en claro. */
  primary: string;
  /** Texto/ícono sobre un relleno `primary`. */
  primaryText: string;
  danger: string;
  /** Verde de "va bien / positivo" (signo de un ingreso, objetivo adelantado). */
  ok: string;
  /** Relleno tenue para chips, íconos, barras de fondo, divisores internos. */
  faint: string;
  /** Segundo nivel de relleno tenue (bordes de fila dentro de una lista). */
  panelAlt: string;
  /** Tinte muy sutil para cajas de ayuda / información. */
  info: string;
}

/**
 * Rediseño "estilo Rimu" (variante C, sesión 2026-09-06): monocromo de alto
 * contraste. El blanco/negro es el protagonista; el color se reserva para el
 * signo (rojo negativo, verde positivo). Sin azul primario.
 *
 * Claro = blanco puro, paneles gris casi imperceptible, texto casi negro —
 * misma jerarquía que el oscuro (número gigante, curva con degradado, barra
 * fina, mayúsculas con tracking) para que se sientan como la misma app.
 */
export const CLARO: Paleta = {
  fondo: '#ffffff',
  bg: '#f7f7f8',
  text: '#0a0a0a',
  muted: '#6b6b70',
  mutedDim: '#9a9a9e',
  border: '#e4e4e6',
  primary: '#0a0a0a',
  primaryText: '#ffffff',
  danger: '#c0392b',
  ok: '#1e8e5a',
  faint: '#efeff1',
  panelAlt: '#e9e9ec',
  info: '#f0f0f2',
};

/**
 * Oscuro = negro puro (#000, no gris azulado), paneles apenas más claros que
 * el fondo; la separación la da el espacio, no el borde marcado.
 */
export const OSCURO: Paleta = {
  fondo: '#000000',
  bg: '#0a0a0a',
  text: '#f5f5f5',
  muted: '#8a8a8e',
  mutedDim: '#5a5a5e',
  border: '#1c1c1e',
  primary: '#f5f5f5',
  primaryText: '#000000',
  danger: '#ff5c5c',
  ok: '#34d399',
  faint: '#141416',
  panelAlt: '#111113',
  info: '#0f0f10',
};

export type ModoTema = 'sistema' | 'claro' | 'oscuro';
const CLAVE = 'patrimonia.tema';

interface TemaCtx {
  c: Paleta;
  oscuro: boolean;
  modo: ModoTema;
  setModo: (m: ModoTema) => void;
}

const Ctx = createContext<TemaCtx>({
  c: CLARO,
  oscuro: false,
  modo: 'sistema',
  setModo: () => undefined,
});

export function TemaProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [modo, setModoState] = useState<ModoTema>('sistema');

  useEffect(() => {
    leer(CLAVE).then((v) => {
      if (v === 'claro' || v === 'oscuro' || v === 'sistema') setModoState(v);
    });
  }, []);

  const setModo = (m: ModoTema) => {
    setModoState(m);
    void guardar(CLAVE, m);
  };

  const oscuro = modo === 'oscuro' || (modo === 'sistema' && sistema === 'dark');
  const c = oscuro ? OSCURO : CLARO;

  return createElement(Ctx.Provider, { value: { c, oscuro, modo, setModo } }, children);
}

/** Paleta activa. Usar en componentes: `const c = useC();`. */
export function useC(): Paleta {
  return useContext(Ctx).c;
}

/** Control del modo de tema (para la pantalla de Ajustes). */
export function useTema(): { modo: ModoTema; oscuro: boolean; setModo: (m: ModoTema) => void } {
  const { modo, oscuro, setModo } = useContext(Ctx);
  return { modo, oscuro, setModo };
}
