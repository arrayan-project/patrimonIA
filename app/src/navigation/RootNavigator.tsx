import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../ui';

import { LoginScreen } from '../screens/LoginScreen';
import { RegistroScreen } from '../screens/RegistroScreen';
import { BienvenidaScreen } from '../screens/BienvenidaScreen';
import { CrearHogarScreen } from '../screens/CrearHogarScreen';
import { InvitacionesScreen } from '../screens/InvitacionesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MovimientosScreen } from '../screens/MovimientosScreen';
import { HogarScreen } from '../screens/HogarScreen';
import { AgregarElementoScreen } from '../screens/AgregarElementoScreen';
import { RegistrarMovimientoScreen } from '../screens/RegistrarMovimientoScreen';
import { ElementoDetalleScreen } from '../screens/ElementoDetalleScreen';
import { MovimientoDetalleScreen } from '../screens/MovimientoDetalleScreen';
import { ValorizarScreen } from '../screens/ValorizarScreen';
import { ValorizacionDetalleScreen } from '../screens/ValorizacionDetalleScreen';
import { RegistrarAjusteScreen } from '../screens/RegistrarAjusteScreen';
import { AjusteDetalleScreen } from '../screens/AjusteDetalleScreen';
import { EditarElementoScreen } from '../screens/EditarElementoScreen';
import { GestionHogarScreen } from '../screens/GestionHogarScreen';
import { PerfilScreen } from '../screens/PerfilScreen';
import { ObjetivosScreen } from '../screens/ObjetivosScreen';
import { ObjetivoDetalleScreen } from '../screens/ObjetivoDetalleScreen';
import { AsignacionDetalleScreen } from '../screens/AsignacionDetalleScreen';
import { PresupuestosScreen } from '../screens/PresupuestosScreen';
import { PresupuestoDetalleScreen } from '../screens/PresupuestoDetalleScreen';
import { PresupuestoRubrosScreen } from '../screens/PresupuestoRubrosScreen';
import { MovimientosProgramadosScreen } from '../screens/MovimientosProgramadosScreen';
import { MovimientoProgramadoDetalleScreen } from '../screens/MovimientoProgramadoDetalleScreen';
import { EvolucionPatrimonioScreen } from '../screens/EvolucionPatrimonioScreen';
import { HogarConsolidadoScreen } from '../screens/HogarConsolidadoScreen';
import { NotificacionesScreen } from '../screens/NotificacionesScreen';
import { TiposCambioScreen } from '../screens/TiposCambioScreen';
import { AjustesScreen } from '../screens/AjustesScreen';
import { CategoriasScreen } from '../screens/CategoriasScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Cargando() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];
const icono = (nombre: NombreIcono) => {
  const Icono = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={nombre} color={color} size={size} />
  );
  Icono.displayName = `TabIcon(${nombre})`;
  return Icono;
};

/** Barra de tabs inferior — la navegación principal de la app con hogar. */
function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Inicio', tabBarIcon: icono('home-outline') }}
      />
      <Tab.Screen
        name="Movimientos"
        component={MovimientosScreen}
        options={{ tabBarLabel: 'Movimientos', tabBarIcon: icono('swap-horizontal') }}
      />
      <Tab.Screen
        name="Objetivos"
        component={ObjetivosScreen}
        options={{ tabBarLabel: 'Objetivos', tabBarIcon: icono('flag-outline') }}
      />
      <Tab.Screen
        name="Hogar"
        component={HogarScreen}
        options={{ tabBarLabel: 'Hogar', tabBarIcon: icono('people-outline') }}
      />
      <Tab.Screen
        name="Ajustes"
        component={AjustesScreen}
        options={{ tabBarLabel: 'Ajustes', tabBarIcon: icono('settings-outline') }}
      />
    </Tab.Navigator>
  );
}

/** Título del header nativo por ruta (las que no lo definen usan el nombre). */
const TITULOS: Record<string, string> = {
  Bienvenida: 'Bienvenido',
  CrearHogar: 'Crear hogar',
  Invitaciones: 'Invitaciones',
  AgregarElemento: 'Agregar elemento',
  RegistrarMovimiento: 'Registrar movimiento',
  ElementoDetalle: 'Detalle',
  MovimientoDetalle: 'Movimiento',
  Valorizar: 'Valorizar',
  ValorizacionDetalle: 'Valorización',
  RegistrarAjuste: 'Registrar ajuste',
  AjusteDetalle: 'Ajuste',
  EditarElemento: 'Editar elemento',
  GestionHogar: 'Gestionar hogar',
  Perfil: 'Mi perfil',
  ObjetivoDetalle: 'Objetivo',
  AsignacionDetalle: 'Asignación',
  Presupuestos: 'Presupuestos',
  PresupuestoDetalle: 'Presupuesto',
  PresupuestoRubros: 'Presupuesto por rubro',
  MovimientosProgramados: 'Movimientos programados',
  MovimientoProgramadoDetalle: 'Movimiento programado',
  EvolucionPatrimonio: 'Evolución de mi patrimonio',
  HogarConsolidado: 'Patrimonio del hogar',
  Notificaciones: 'Notificaciones',
  TiposCambio: 'Tipos de cambio',
  Categorias: 'Categorías de movimiento',
};

/** Pantallas que se apilan sobre los Tabs, con header nativo (título + atrás). */
const PANTALLAS_STACK: [string, React.ComponentType][] = [
  ['CrearHogar', CrearHogarScreen],
  ['Invitaciones', InvitacionesScreen],
  ['AgregarElemento', AgregarElementoScreen],
  ['RegistrarMovimiento', RegistrarMovimientoScreen],
  ['ElementoDetalle', ElementoDetalleScreen],
  ['MovimientoDetalle', MovimientoDetalleScreen],
  ['Valorizar', ValorizarScreen],
  ['ValorizacionDetalle', ValorizacionDetalleScreen],
  ['RegistrarAjuste', RegistrarAjusteScreen],
  ['AjusteDetalle', AjusteDetalleScreen],
  ['EditarElemento', EditarElementoScreen],
  ['GestionHogar', GestionHogarScreen],
  ['Perfil', PerfilScreen],
  ['ObjetivoDetalle', ObjetivoDetalleScreen],
  ['AsignacionDetalle', AsignacionDetalleScreen],
  ['Presupuestos', PresupuestosScreen],
  ['PresupuestoDetalle', PresupuestoDetalleScreen],
  ['PresupuestoRubros', PresupuestoRubrosScreen],
  ['MovimientosProgramados', MovimientosProgramadosScreen],
  ['MovimientoProgramadoDetalle', MovimientoProgramadoDetalleScreen],
  ['EvolucionPatrimonio', EvolucionPatrimonioScreen],
  ['HogarConsolidado', HogarConsolidadoScreen],
  ['Notificaciones', NotificacionesScreen],
  ['TiposCambio', TiposCambioScreen],
  ['Categorias', CategoriasScreen],
];

export function RootNavigator() {
  const { session, cargando } = useAuth();
  const [inicial, setInicial] = useState<'Tabs' | 'Bienvenida' | null>(null);

  useEffect(() => {
    if (!session) {
      setInicial(null);
      return;
    }
    let vivo = true;
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', session.token)
      .then((h) => vivo && setInicial(h.length > 0 ? 'Tabs' : 'Bienvenida'))
      .catch((e: unknown) => vivo && setInicial(e instanceof ApiError ? 'Bienvenida' : 'Bienvenida'));
    return () => {
      vivo = false;
    };
  }, [session]);

  if (cargando || (session && !inicial)) return <Cargando />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
        }}
        initialRouteName={session ? (inicial ?? 'Bienvenida') : 'Registro'}
      >
        {!session ? (
          <>
            <Stack.Screen name="Registro" component={RegistroScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="Bienvenida"
              component={BienvenidaScreen}
              options={{ headerShown: false }}
            />
            {PANTALLAS_STACK.map(([name, Comp]) => (
              <Stack.Screen
                key={name}
                name={name}
                component={Comp}
                options={{ title: TITULOS[name] ?? name }}
              />
            ))}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
