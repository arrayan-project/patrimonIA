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
  /** Relleno suave del acento (selector, ícono, anillo de fondo). */
  acentoSuave: string;
  /** Degradado de la cifra protagonista (Hero), de arriba-izquierda a abajo-derecha. */
  heroA: string;
  heroB: string;
  /** Colores de las tarjetas de cuenta del Inicio; texto en blanco encima. */
  tarjetas: readonly string[];
}

/**
 * G35, Paso 0 (Juan, 2026-10-09): dirección visual amigable — lila y pastel,
 * con color por tema (`Docs/usabilidad/prototipo/direccion-visual-s02.html`).
 * El fondo apenas tiñe; las tarjetas son blancas con borde suave. Verde y rojo
 * siguen siendo solo el signo de los montos. Mismas claves en claro y oscuro.
 */
export const CLARO: Paleta = {
  fondo: '#f8f6fd',
  bg: '#ffffff',
  text: '#2b2540',
  muted: '#756e8c',
  mutedDim: '#a59fba',
  border: '#ebe6f5',
  primary: '#7c5cff',
  primaryText: '#ffffff',
  danger: '#d9434d',
  ok: '#1a8f5f',
  faint: '#f1ecfb',
  panelAlt: '#f3effb',
  info: '#f4f0ff',
  okFondo: 'rgba(26,143,95,0.1)',
  dangerFondo: 'rgba(217,67,77,0.09)',
  acentoSuave: '#ece5ff',
  heroA: '#ffe4da',
  heroB: '#e9dcff',
  tarjetas: ['#2a4494', '#f07a2a', '#13867c', '#c2304f', '#7c5cff', '#0e7490'],
};

export const OSCURO: Paleta = {
  fondo: '#16131f',
  bg: '#1e1a2a',
  text: '#f0ecfa',
  muted: '#a59dbd',
  mutedDim: '#6f6888',
  border: '#2c2640',
  primary: '#a68dff',
  primaryText: '#16131f',
  danger: '#ff7d85',
  ok: '#5fd6a4',
  faint: '#262036',
  panelAlt: '#262036',
  info: '#221d32',
  okFondo: 'rgba(95,214,164,0.14)',
  dangerFondo: 'rgba(255,125,133,0.14)',
  acentoSuave: '#2e2648',
  heroA: '#3a2630',
  heroB: '#2c2347',
  tarjetas: ['#3b5bdb', '#e0691b', '#14918a', '#d6334f', '#7c5cff', '#1597b5'],
};

/**
 * Radios del prototipo, por papel: campo de texto, botón, tarjeta, hoja
 * modal, ícono de fila y pastilla (chip, segmento).
 */
export const radio = { campo: 14, boton: 16, tarjeta: 20, hoja: 26, icono: 12, pastilla: 999 } as const;

/**
 * Jerarquía tipográfica del prototipo (sin color: lo pone cada componente).
 * `monto` = monto protagonista de un formulario; `hero` = número de cabecera;
 * `pregunta` = pregunta de un formulario; `fila` / `filaSub` = filas de lista;
 * `rotulo` = etiqueta corta (grupo de lista, nombre de la cifra);
 * `seccion` = título de una sección ("Tus metas"). G35: sin mayúsculas, más
 * cercano. La letra (Nunito) la pone `ui/Text` según el grosor.
 */
export const tipografia = {
  hero: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6 },
  monto: { fontSize: 38, fontWeight: '700', letterSpacing: -0.5 },
  tituloPantalla: { fontSize: 18, fontWeight: '700' },
  pregunta: { fontSize: 15, fontWeight: '600' },
  fila: { fontSize: 15, fontWeight: '600' },
  filaSub: { fontSize: 12 },
  rotulo: { fontSize: 13, fontWeight: '700' },
  seccion: { fontSize: 19, fontWeight: '800' },
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
