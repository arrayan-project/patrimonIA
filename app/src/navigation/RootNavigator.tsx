import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../ui';

import { LoginScreen } from '../screens/LoginScreen';
import { RegistroScreen } from '../screens/RegistroScreen';
import { BienvenidaScreen } from '../screens/BienvenidaScreen';
import { CrearHogarScreen } from '../screens/CrearHogarScreen';
import { InvitacionesScreen } from '../screens/InvitacionesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
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
import { MovimientosProgramadosScreen } from '../screens/MovimientosProgramadosScreen';
import { MovimientoProgramadoDetalleScreen } from '../screens/MovimientoProgramadoDetalleScreen';
import { EvolucionPatrimonioScreen } from '../screens/EvolucionPatrimonioScreen';
import { HogarConsolidadoScreen } from '../screens/HogarConsolidadoScreen';
import { NotificacionesScreen } from '../screens/NotificacionesScreen';
import { TiposCambioScreen } from '../screens/TiposCambioScreen';

const Stack = createNativeStackNavigator();

function Cargando() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const PANTALLAS_APP: [string, React.ComponentType][] = [
  ['Bienvenida', BienvenidaScreen],
  ['CrearHogar', CrearHogarScreen],
  ['Invitaciones', InvitacionesScreen],
  ['Dashboard', DashboardScreen],
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
  ['Objetivos', ObjetivosScreen],
  ['ObjetivoDetalle', ObjetivoDetalleScreen],
  ['AsignacionDetalle', AsignacionDetalleScreen],
  ['Presupuestos', PresupuestosScreen],
  ['PresupuestoDetalle', PresupuestoDetalleScreen],
  ['MovimientosProgramados', MovimientosProgramadosScreen],
  ['MovimientoProgramadoDetalle', MovimientoProgramadoDetalleScreen],
  ['EvolucionPatrimonio', EvolucionPatrimonioScreen],
  ['HogarConsolidado', HogarConsolidadoScreen],
  ['Notificaciones', NotificacionesScreen],
  ['TiposCambio', TiposCambioScreen],
];

export function RootNavigator() {
  const { session, cargando } = useAuth();
  const [inicial, setInicial] = useState<'Dashboard' | 'Bienvenida' | null>(null);

  useEffect(() => {
    if (!session) {
      setInicial(null);
      return;
    }
    let vivo = true;
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', session.token)
      .then((h) => vivo && setInicial(h.length > 0 ? 'Dashboard' : 'Bienvenida'))
      .catch((e: unknown) => vivo && setInicial(e instanceof ApiError ? 'Bienvenida' : 'Bienvenida'));
    return () => {
      vivo = false;
    };
  }, [session]);

  if (cargando || (session && !inicial)) return <Cargando />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        initialRouteName={session ? (inicial ?? 'Bienvenida') : 'Registro'}
      >
        {!session ? (
          <>
            <Stack.Screen name="Registro" component={RegistroScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : (
          PANTALLAS_APP.map(([name, Comp]) => (
            <Stack.Screen key={name} name={name} component={Comp} />
          ))
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
