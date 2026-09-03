import { useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

/**
 * Fachada estable sobre `@react-navigation/native`. Las pantallas usan `useNav()`
 * y no conocen la librería de navegación por debajo (antes era una pila a mano).
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
  | 'AjusteDetalle'
  | 'EditarElemento'
  | 'GestionHogar'
  | 'Perfil'
  | 'Objetivos'
  | 'ObjetivoDetalle'
  | 'AsignacionDetalle'
  | 'Presupuestos'
  | 'PresupuestoDetalle'
  | 'MovimientosProgramados'
  | 'MovimientoProgramadoDetalle'
  | 'EvolucionPatrimonio'
  | 'HogarConsolidado'
  | 'Notificaciones'
  | 'TiposCambio';

export interface Route {
  name: string;
  params?: Record<string, unknown>;
}

export interface NavHandle {
  route: Route;
  go: (name: RouteName, params?: Record<string, unknown>) => void;
  reset: (name: RouteName, params?: Record<string, unknown>) => void;
  back: () => void;
  canGoBack: boolean;
}

export function useNav(): NavHandle {
  // El navegador se declara sin tipos por-ruta; el union RouteName es el contrato.
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
    canGoBack: () => boolean;
    reset: (state: { index: number; routes: { name: string; params?: unknown }[] }) => void;
  }>();
  const route = useRoute();

  // Estable entre renders (navigation es un ref fijo; route cambia solo con params)
  // para no romper dependencias de useEffect/useCallback en las pantallas.
  return useMemo<NavHandle>(
    () => ({
      route: { name: route.name, params: route.params as Record<string, unknown> | undefined },
      go: (name, params) => navigation.navigate(name, params),
      back: () => navigation.goBack(),
      reset: (name, params) => navigation.reset({ index: 0, routes: [{ name, params }] }),
      canGoBack: navigation.canGoBack(),
    }),
    [navigation, route.name, route.params],
  );
}
