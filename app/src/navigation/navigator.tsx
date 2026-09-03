import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Navegación mínima por pila para el esqueleto de Fase 1. Cuando el número de
 * pantallas crezca se reemplaza por @react-navigation/native.
 */
export type RouteName =
  | 'Login'
  | 'Registro'
  | 'Bienvenida'
  | 'CrearHogar'
  | 'Invitaciones'
  | 'Dashboard'
  | 'AgregarElemento'
  | 'RegistrarMovimiento'
  | 'ElementoDetalle'
  | 'MovimientoDetalle'
  | 'Valorizar'
  | 'ValorizacionDetalle'
  | 'RegistrarAjuste'
  | 'AjusteDetalle';

export interface Route {
  name: RouteName;
  params?: Record<string, unknown>;
}

interface NavContextValue {
  route: Route;
  go: (name: RouteName, params?: Record<string, unknown>) => void;
  reset: (name: RouteName, params?: Record<string, unknown>) => void;
  back: () => void;
  canGoBack: boolean;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);

  const go = useCallback((name: RouteName, params?: Record<string, unknown>) => {
    setStack((s) => [...s, { name, params }]);
  }, []);

  const reset = useCallback((name: RouteName, params?: Record<string, unknown>) => {
    setStack([{ name, params }]);
  }, []);

  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const value = useMemo<NavContextValue>(
    () => ({ route: stack[stack.length - 1], go, reset, back, canGoBack: stack.length > 1 }),
    [stack, go, reset, back],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav fuera de <NavProvider>');
  return ctx;
}
