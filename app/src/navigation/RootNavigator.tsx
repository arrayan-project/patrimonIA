import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { fuente } from '../ui/Text';
import { useC, useTema } from '../ui';

import { LoginScreen } from '../screens/LoginScreen';
import { RegistroScreen } from '../screens/RegistroScreen';
import { RecuperarPasswordScreen } from '../screens/RecuperarPasswordScreen';
import { BienvenidaScreen } from '../screens/BienvenidaScreen';
import { CrearHogarScreen } from '../screens/CrearHogarScreen';
import { InvitacionesScreen } from '../screens/InvitacionesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MovimientosScreen } from '../screens/MovimientosScreen';
import { PlanificarScreen } from '../screens/PlanificarScreen';
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
import { HistorialScreen } from '../screens/HistorialScreen';
import { GestionHogarScreen } from '../screens/GestionHogarScreen';
import { PerfilScreen } from '../screens/PerfilScreen';
import { ObjetivosScreen } from '../screens/ObjetivosScreen';
import { ObjetivoDetalleScreen } from '../screens/ObjetivoDetalleScreen';
import { AhorrarScreen } from '../screens/AhorrarScreen';
import { AsignacionesScreen } from '../screens/AsignacionesScreen';
import { AsignacionDetalleScreen } from '../screens/AsignacionDetalleScreen';
import { PresupuestosScreen } from '../screens/PresupuestosScreen';
import { PresupuestoDetalleScreen } from '../screens/PresupuestoDetalleScreen';
import { PresupuestoRubrosScreen } from '../screens/PresupuestoRubrosScreen';
import { GastosCategoriaScreen } from '../screens/GastosCategoriaScreen';
import { MovimientosProgramadosScreen } from '../screens/MovimientosProgramadosScreen';
import { PlantillasScreen } from '../screens/PlantillasScreen';
import { MovimientoProgramadoDetalleScreen } from '../screens/MovimientoProgramadoDetalleScreen';
import { EvolucionPatrimonioScreen } from '../screens/EvolucionPatrimonioScreen';
import { HogarConsolidadoScreen } from '../screens/HogarConsolidadoScreen';
import { MovimientosHogarScreen } from '../screens/MovimientosHogarScreen';
import { NotificacionesScreen } from '../screens/NotificacionesScreen';
import { TiposCambioScreen } from '../screens/TiposCambioScreen';
import { AjustesScreen } from '../screens/AjustesScreen';
import { AjustesVisualizacionScreen } from '../screens/AjustesVisualizacionScreen';
import { PatrimonioSeccionScreen } from '../screens/PatrimonioSeccionScreen';
import { CategoriasScreen } from '../screens/CategoriasScreen';
import { CatalogoFormScreen } from '../screens/CatalogoFormScreen';
import { MetaFormScreen } from '../screens/MetaFormScreen';
import { PresupuestoFormScreen } from '../screens/PresupuestoFormScreen';
import { NuevoProgramadoScreen } from '../screens/NuevoProgramadoScreen';
import { PlantillaFormScreen } from '../screens/PlantillaFormScreen';
import { AccionFormScreen } from '../screens/AccionFormScreen';
import { CorreccionFormScreen } from '../screens/CorreccionFormScreen';
import { CorregirMovimientoScreen } from '../screens/CorregirMovimientoScreen';
import { ProgramadoFormScreen } from '../screens/ProgramadoFormScreen';
import { SacarPlataScreen } from '../screens/SacarPlataScreen';
import { PagarSolicitudScreen } from '../screens/PagarSolicitudScreen';
import { EntreMiembrosScreen } from '../screens/EntreMiembrosScreen';
import { ValorEnFechaScreen } from '../screens/ValorEnFechaScreen';
import { AjustesElementoScreen } from '../screens/AjustesElementoScreen';
import { TiposElementoScreen } from '../screens/TiposElementoScreen';
import { EtiquetasScreen } from '../screens/EtiquetasScreen';
import { AgrupacionesScreen } from '../screens/AgrupacionesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Cargando() {
  const c = useC();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.primary} />
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
  const c = useC();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedDim,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border },
        tabBarLabelStyle: fuente('700'),
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
        options={{ tabBarLabel: 'Movimientos', tabBarIcon: icono('swap-vertical-outline') }}
      />
      <Tab.Screen
        name="Planificar"
        component={PlanificarScreen}
        options={{ tabBarLabel: 'Planificar', tabBarIcon: icono('flag-outline') }}
      />
      <Tab.Screen
        name="Hogar"
        component={HogarScreen}
        options={{ tabBarLabel: 'Hogar', tabBarIcon: icono('people-outline') }}
      />
    </Tab.Navigator>
  );
}

/** Título del header nativo por ruta (las que no lo definen usan el nombre). */
const TITULOS: Record<string, string> = {
  Bienvenida: 'Bienvenido',
  CrearHogar: 'Crear hogar',
  Invitaciones: 'Invitaciones pendientes',
  AgregarElemento: 'Agregar cuenta o bien',
  RegistrarMovimiento: 'Registrar movimiento',
  ElementoDetalle: 'Detalle',
  MovimientoDetalle: 'Movimiento',
  Valorizar: 'Actualizar cuánto vale',
  ValorizacionDetalle: 'Cambio de valor',
  RegistrarAjuste: 'Corregir el saldo',
  AjusteDetalle: 'Corrección de saldo',
  EditarElemento: 'Editar',
  Historial: 'Historial de cambios',
  GestionHogar: 'Gestionar hogar',
  Perfil: 'Mi perfil',
  Objetivos: 'Metas',
  ObjetivoDetalle: 'Meta',
  Ahorrar: 'Ahorrar para una meta',
  Asignaciones: 'Ahorro sin meta',
  AsignacionDetalle: 'Ahorro',
  Presupuestos: 'Presupuestos',
  PresupuestoDetalle: 'Presupuesto',
  PresupuestoRubros: 'Repartir por categoría',
  GastosCategoria: 'Gastos',
  MovimientosProgramados: 'Movimientos programados',
  MovimientoProgramadoDetalle: 'Movimiento programado',
  Plantillas: 'Frecuentes',
  EvolucionPatrimonio: '¿Cómo ha cambiado tu plata?',
  HogarConsolidado: 'Patrimonio del hogar',
  MovimientosHogar: 'Movimientos del hogar',
  Notificaciones: 'Notificaciones',
  TiposCambio: 'Tipos de cambio',
  Ajustes: 'Ajustes',
  AjustesVisualizacion: 'Secciones del Inicio',
  PatrimonioSeccion: 'Tu plata',
  Categorias: 'Categorías',
  TiposElemento: 'Tipos de cuenta',
  Etiquetas: 'Etiquetas',
  Agrupaciones: 'Agrupaciones',
  // CatalogoForm y PlantillaForm ponen su título con useTitulo (crear o editar).
  CatalogoForm: 'Nuevo',
  MetaForm: 'Nueva meta',
  PresupuestoForm: 'Nuevo presupuesto',
  NuevoProgramado: 'Programar movimiento',
  PlantillaForm: 'Nuevo frecuente',
  // AccionForm, CorreccionForm, ProgramadoForm y SacarPlata ponen su título con useTitulo.
  AccionForm: 'Confirmar',
  CorreccionForm: 'Corregir',
  CorregirMovimiento: 'Editar movimiento',
  ProgramadoForm: 'Editar programado',
  SacarPlata: 'Sacar',
  PagarSolicitud: 'Pagar',
  EntreMiembros: 'Entre ustedes',
  ValorEnFecha: '¿Cuánto valía antes?',
  AjustesElemento: 'Ajustes de la cuenta',
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
  ['Historial', HistorialScreen],
  ['GestionHogar', GestionHogarScreen],
  ['Perfil', PerfilScreen],
  ['Objetivos', ObjetivosScreen],
  ['ObjetivoDetalle', ObjetivoDetalleScreen],
  ['Ahorrar', AhorrarScreen],
  ['Asignaciones', AsignacionesScreen],
  ['AsignacionDetalle', AsignacionDetalleScreen],
  ['Presupuestos', PresupuestosScreen],
  ['PresupuestoDetalle', PresupuestoDetalleScreen],
  ['PresupuestoRubros', PresupuestoRubrosScreen],
  ['GastosCategoria', GastosCategoriaScreen],
  ['MovimientosProgramados', MovimientosProgramadosScreen],
  ['MovimientoProgramadoDetalle', MovimientoProgramadoDetalleScreen],
  ['Plantillas', PlantillasScreen],
  ['EvolucionPatrimonio', EvolucionPatrimonioScreen],
  ['HogarConsolidado', HogarConsolidadoScreen],
  ['MovimientosHogar', MovimientosHogarScreen],
  ['Notificaciones', NotificacionesScreen],
  ['TiposCambio', TiposCambioScreen],
  ['Ajustes', AjustesScreen],
  ['AjustesVisualizacion', AjustesVisualizacionScreen],
  ['PatrimonioSeccion', PatrimonioSeccionScreen],
  ['Categorias', CategoriasScreen],
  ['TiposElemento', TiposElementoScreen],
  ['Etiquetas', EtiquetasScreen],
  ['Agrupaciones', AgrupacionesScreen],
  ['CatalogoForm', CatalogoFormScreen],
  ['MetaForm', MetaFormScreen],
  ['PresupuestoForm', PresupuestoFormScreen],
  ['NuevoProgramado', NuevoProgramadoScreen],
  ['PlantillaForm', PlantillaFormScreen],
  ['AccionForm', AccionFormScreen],
  ['CorreccionForm', CorreccionFormScreen],
  ['CorregirMovimiento', CorregirMovimientoScreen],
  ['ProgramadoForm', ProgramadoFormScreen],
  ['SacarPlata', SacarPlataScreen],
  ['PagarSolicitud', PagarSolicitudScreen],
  ['EntreMiembros', EntreMiembrosScreen],
  ['ValorEnFecha', ValorEnFechaScreen],
  ['AjustesElemento', AjustesElementoScreen],
];

export function RootNavigator() {
  const { session, cargando } = useAuth();
  const c = useC();
  const { oscuro } = useTema();
  const [inicial, setInicial] = useState<'Tabs' | 'Bienvenida' | null>(null);

  const temaNav = {
    ...(oscuro ? DarkTheme : DefaultTheme),
    colors: {
      ...(oscuro ? DarkTheme : DefaultTheme).colors,
      primary: c.primary,
      background: c.fondo,
      card: c.bg,
      text: c.text,
      border: c.border,
    },
  };

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
    <NavigationContainer theme={temaNav}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: c.text,
          headerTitleStyle: { color: c.text, ...fuente('800') },
          headerStyle: { backgroundColor: c.fondo },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.fondo },
        }}
        initialRouteName={session ? (inicial ?? 'Bienvenida') : 'Registro'}
      >
        {!session ? (
          <>
            <Stack.Screen name="Registro" component={RegistroScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="RecuperarPassword"
              component={RecuperarPasswordScreen}
              options={{ headerShown: false }}
            />
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
