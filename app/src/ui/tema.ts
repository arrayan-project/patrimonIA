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
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  /** Relleno tenue para chips, íconos, barras de fondo. */
  faint: string;
  /** Tinte para cajas de ayuda / información. */
  info: string;
}

export const CLARO: Paleta = {
  fondo: '#f3f4f6',
  bg: '#ffffff',
  text: '#111827',
  muted: '#4b5563',
  border: '#e5e7eb',
  primary: '#1d4ed8',
  primaryText: '#ffffff',
  danger: '#b91c1c',
  faint: '#eef1f5',
  info: '#eff6ff',
};

/**
 * Estética inspirada en apps tipo "rimu": fondo casi negro, tarjetas apenas
 * más claras que el fondo (la separación la da el borde, no la sombra),
 * bordes muy sutiles y un solo acento saturado — acá se mantiene el azul en
 * vez de pasar a verde (decisión del usuario, sesión 2026-09-04).
 */
export const OSCURO: Paleta = {
  fondo: '#08090a',
  bg: '#111214',
  text: '#f2f2f0',
  muted: '#8b8b90',
  border: '#242429',
  primary: '#3b82f6',
  primaryText: '#ffffff',
  danger: '#ef4444',
  faint: '#0d0e10',
  info: '#101a2c',
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
