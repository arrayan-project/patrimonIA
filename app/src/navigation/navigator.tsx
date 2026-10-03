import { useLayoutEffect, useMemo, useRef } from 'react';
import { Pressable, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useC } from '../ui/tema';

/**
 * Fachada estable sobre `@react-navigation/native`. Las pantallas usan `useNav()`
 * y no conocen la librería de navegación por debajo (antes era una pila a mano).
 */
export type RouteName =
  | 'Login'
  | 'Registro'
  | 'RecuperarPassword'
  | 'Tabs'
  | 'Bienvenida'
  | 'CrearHogar'
  | 'Invitaciones'
  | 'Dashboard'
  | 'Movimientos'
  | 'Planificar'
  | 'Hogar'
  | 'AgregarElemento'
  | 'RegistrarMovimiento'
  | 'ElementoDetalle'
  | 'MovimientoDetalle'
  | 'Valorizar'
  | 'ValorizacionDetalle'
  | 'RegistrarAjuste'
  | 'AjusteDetalle'
  | 'EditarElemento'
  | 'Historial'
  | 'GestionHogar'
  | 'Perfil'
  | 'Objetivos'
  | 'ObjetivoDetalle'
  | 'Ahorrar'
  | 'Asignaciones'
  | 'AsignacionDetalle'
  | 'Presupuestos'
  | 'PresupuestoDetalle'
  | 'PresupuestoRubros'
  | 'MovimientosProgramados'
  | 'MovimientoProgramadoDetalle'
  | 'Plantillas'
  | 'EvolucionPatrimonio'
  | 'HogarConsolidado'
  | 'MovimientosHogar'
  | 'Notificaciones'
  | 'TiposCambio'
  | 'Ajustes'
  | 'AjustesNotificaciones'
  | 'AjustesVisualizacion'
  | 'PatrimonioSeccion'
  | 'Categorias'
  | 'TiposElemento'
  | 'Etiquetas'
  | 'Agrupaciones'
  | 'CatalogoForm'
  | 'NuevaMeta'
  | 'PresupuestoForm'
  | 'NuevoProgramado'
  | 'PlantillaForm'
  | 'AccionForm'
  | 'CorreccionForm'
  | 'CorregirMovimiento'
  | 'ProgramadoForm'
  | 'SacarPlata'
  | 'ValorEnFecha';

export interface Route {
  name: string;
  params?: Record<string, unknown>;
}

export interface NavHandle {
  route: Route;
  go: (name: RouteName, params?: Record<string, unknown>) => void;
  /** Deja `name` como raíz; `encima` apila pantallas sobre ella (p. ej. un paso de onboarding). */
  reset: (
    name: RouteName,
    params?: Record<string, unknown>,
    encima?: { name: RouteName; params?: Record<string, unknown> }[],
  ) => void;
  /** Vuelve una pantalla, o `n` (p. ej. 2 tras borrar desde un Formulario abierto por un Detalle). */
  back: (n?: number) => void;
  /** Vuelve a los Tabs (sin apilar otra copia) y abre `tab` con `params`. */
  irATab: (tab: RouteName, params?: Record<string, unknown>) => void;
  canGoBack: boolean;
}

interface NavApi {
  navigate: (name: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  pop: (n?: number) => void;
  popTo: (name: string, params?: Record<string, unknown>) => void;
  canGoBack: () => boolean;
  getParent: () => NavApi | undefined;
  reset: (state: { index: number; routes: { name: string; params?: unknown }[] }) => void;
  setOptions: (opciones: { title?: string; headerRight?: () => React.ReactNode }) => void;
}

export function useNav(): NavHandle {
  // El navegador se declara sin tipos por-ruta; el union RouteName es el contrato.
  const navigation = useNavigation<NavApi>();
  const route = useRoute();

  // Estable entre renders (navigation es un ref fijo; route cambia solo con params)
  // para no romper dependencias de useEffect/useCallback en las pantallas.
  return useMemo<NavHandle>(
    () => ({
      route: { name: route.name, params: route.params as Record<string, unknown> | undefined },
      go: (name, params) => navigation.navigate(name, params),
      back: (n = 1) => (n > 1 ? navigation.pop(n) : navigation.goBack()),
      irATab: (tab, params) => navigation.popTo('Tabs', { screen: tab, params }),
      reset: (name, params, encima = []) => {
        // reset siempre sobre el navegador raíz (el stack que contiene los Tabs),
        // no sobre el tab actual.
        let raiz = navigation;
        while (raiz.getParent?.()) raiz = raiz.getParent()!;
        const routes = [{ name, params }, ...encima];
        raiz.reset({ index: routes.length - 1, routes });
      },
      canGoBack: navigation.canGoBack(),
    }),
    [navigation, route.name, route.params],
  );
}

/**
 * Título de la barra superior según los datos de la pantalla (p. ej. el nombre
 * de la meta). Hay un solo título: no se repite dentro del contenido.
 */
export function useTitulo(titulo: string | undefined): void {
  const navigation = useNavigation<NavApi>();
  useLayoutEffect(() => {
    if (titulo) navigation.setOptions({ title: titulo });
  }, [navigation, titulo]);
}

/**
 * Acción arriba a la derecha de un Detalle (plantilla Detalle: "Editar abre el
 * Formulario con los datos cargados"). Sin `onPress`, no se muestra.
 */
export function useAccionHeader(titulo: string, onPress: (() => void) | undefined): void {
  const navigation = useNavigation<NavApi>();
  const c = useC();
  // El handler cambia en cada render; se lee desde un ref para no reconfigurar el header siempre.
  const ref = useRef(onPress);
  ref.current = onPress;
  const visible = !!onPress;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: visible
        ? () => (
            <Pressable onPress={() => ref.current?.()} hitSlop={10} accessibilityRole="button" accessibilityLabel={titulo}>
              <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>{titulo}</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, titulo, visible, c]);
}
