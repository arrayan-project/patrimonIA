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
  /** Fondo translúcido de lo positivo (círculo de "listo", pill de alza). */
  okFondo: string;
  /** Fondo translúcido de lo negativo (pill de baja, aviso). */
  dangerFondo: string;
}

/**
 * Bloque 4 de la Fase E (G33): tokens del prototipo validado con Zoily
 * (`Docs/usabilidad/prototipo/prototipo-fase-d-s01.html`). Monocromo de alto
 * contraste; el color se reserva para el signo (rojo negativo, verde positivo).
 * La tarjeta (`bg`) apenas se separa del fondo y la separación la dan el
 * borde y el espacio. Mismas claves en claro y oscuro.
 */
export const CLARO: Paleta = {
  fondo: '#ffffff',
  bg: '#f4f4f5',
  text: '#111113',
  muted: '#6b6b70',
  mutedDim: '#9a9a9f',
  border: '#e4e4e7',
  primary: '#111113',
  primaryText: '#ffffff',
  danger: '#dc2626',
  ok: '#059669',
  faint: '#e9e9ec',
  panelAlt: '#e9e9ec',
  info: '#f4f4f5',
  okFondo: 'rgba(5,150,105,0.1)',
  dangerFondo: 'rgba(220,38,38,0.08)',
};

export const OSCURO: Paleta = {
  fondo: '#000000',
  bg: '#0c0c0d',
  text: '#f5f5f5',
  muted: '#8a8a8e',
  mutedDim: '#5a5a5e',
  border: '#1f1f22',
  primary: '#f5f5f5',
  primaryText: '#000000',
  danger: '#ff5c5c',
  ok: '#34d399',
  faint: '#151517',
  panelAlt: '#151517',
  info: '#0c0c0d',
  okFondo: 'rgba(52,211,153,0.14)',
  dangerFondo: 'rgba(255,92,92,0.14)',
};

/**
 * Radios del prototipo, por papel: campo de texto, botón, tarjeta, hoja
 * modal, ícono de fila y pastilla (chip, segmento).
 */
export const radio = { campo: 12, boton: 14, tarjeta: 16, hoja: 22, icono: 10, pastilla: 999 } as const;

/**
 * Jerarquía tipográfica del prototipo (sin color: lo pone cada componente).
 * `monto` = monto protagonista de un formulario; `hero` = número de cabecera;
 * `pregunta` = pregunta de un formulario; `fila` / `filaSub` = filas de lista;
 * `rotulo` = título de sección en mayúsculas.
 */
export const tipografia = {
  hero: { fontSize: 36, fontWeight: '700', letterSpacing: -0.8 },
  monto: { fontSize: 38, fontWeight: '700', letterSpacing: -0.5 },
  tituloPantalla: { fontSize: 18, fontWeight: '700' },
  pregunta: { fontSize: 15, fontWeight: '600' },
  fila: { fontSize: 15, fontWeight: '600' },
  filaSub: { fontSize: 12 },
  rotulo: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  nota: { fontSize: 13, lineHeight: 19 },
  boton: { fontSize: 16, fontWeight: '700' },
} as const;

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
