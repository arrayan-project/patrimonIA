import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { guardar, leer } from '../auth/secureStorage';

/**
 * Alcance de las vistas de patrimonio: lo mío o lo consolidado del hogar.
 * Estado único y persistente — el toggle es el mismo control en Inicio y en
 * cualquier otra pantalla que lo lea (decisión de IA, sesión 2026-09-06).
 */
export type Alcance = 'mios' | 'hogar';
const CLAVE = 'patrimonia.alcance';

interface Ctx {
  alcance: Alcance;
  setAlcance: (a: Alcance) => void;
}

const AlcanceCtx = createContext<Ctx>({ alcance: 'mios', setAlcance: () => undefined });

export function AlcanceProvider({ children }: { children: ReactNode }) {
  const [alcance, setAlcanceState] = useState<Alcance>('mios');

  useEffect(() => {
    leer(CLAVE).then((v) => {
      if (v === 'mios' || v === 'hogar') setAlcanceState(v);
    });
  }, []);

  const setAlcance = (a: Alcance) => {
    setAlcanceState(a);
    void guardar(CLAVE, a);
  };

  return createElement(AlcanceCtx.Provider, { value: { alcance, setAlcance } }, children);
}

export function useAlcance(): Ctx {
  return useContext(AlcanceCtx);
}
