import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type HogarDTO } from './api/client';
import { useSession } from './auth/AuthContext';
import { NavProvider, useNav, type RouteName } from './navigation/navigator';
import { BienvenidaScreen } from './screens/BienvenidaScreen';
import { CrearHogarScreen } from './screens/CrearHogarScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InvitacionesScreen } from './screens/InvitacionesScreen';
import { colors } from './ui';

function Routes() {
  const { route } = useNav();
  switch (route.name) {
    case 'CrearHogar':
      return <CrearHogarScreen />;
    case 'Invitaciones':
      return <InvitacionesScreen />;
    case 'Dashboard':
      return <DashboardScreen />;
    default:
      return <BienvenidaScreen />;
  }
}

/**
 * Flujo con sesión activa. Al entrar decide la pantalla inicial: si el usuario
 * ya pertenece a un hogar → Dashboard; si no → Bienvenida / Elegir camino.
 */
export function AppFlow() {
  const { token } = useSession();
  const [inicial, setInicial] = useState<RouteName | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hogares) => {
        if (vivo) setInicial(hogares.length > 0 ? 'Dashboard' : 'Bienvenida');
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof ApiError ? e.message : 'Error inesperado');
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!inicial) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavProvider initial={{ name: inicial }}>
      <Routes />
    </NavProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
});
