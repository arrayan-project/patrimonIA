import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { guardar, leer } from '../auth/secureStorage';

/**
 * Alcance de las vistas de patrimonio: lo mío o lo consolidado del hogar.
 * Estado único y persistente — el toggle es el mismo control en Inicio y en
 * cualquier otra pantalla que lo lea (decisión de IA, sesión 2026-09-06).
 * L-4 (S04): si el hogar activo tiene un solo miembro, no hay lente y todo
 * queda en "Lo mío" (lo guardado se respeta para cuando llegue alguien).
 */
export type Alcance = 'mios' | 'hogar';
const CLAVE = 'patrimonia.alcance';

interface Ctx {
  alcance: Alcance;
  setAlcance: (a: Alcance) => void;
  /** false si el hogar activo tiene un solo miembro: no se muestra el selector. */
  lente: boolean;
  /** Lo fija Inicio al cargar el hogar activo (trae sus miembros). */
  setSoloUnMiembro: (v: boolean) => void;
}

const AlcanceCtx = createContext<Ctx>({
  alcance: 'mios',
  setAlcance: () => undefined,
  lente: true,
  setSoloUnMiembro: () => undefined,
});

export function AlcanceProvider({ children }: { children: ReactNode }) {
  const [alcance, setAlcanceState] = useState<Alcance>('mios');
  const [soloUnMiembro, setSoloUnMiembro] = useState(false);

  useEffect(() => {
    leer(CLAVE).then((v) => {
      if (v === 'mios' || v === 'hogar') setAlcanceState(v);
    });
  }, []);

  const setAlcance = (a: Alcance) => {
    setAlcanceState(a);
    void guardar(CLAVE, a);
  };

  return createElement(
    AlcanceCtx.Provider,
    {
      value: {
        alcance: soloUnMiembro ? 'mios' : alcance,
        setAlcance,
        lente: !soloUnMiembro,
        setSoloUnMiembro,
      },
    },
    children,
  );
}

export function useAlcance(): Ctx {
  return useContext(AlcanceCtx);
}
