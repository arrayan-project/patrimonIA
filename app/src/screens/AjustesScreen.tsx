import { StyleSheet, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { colors, LinkButton, Screen, Title } from '../ui';

export function AjustesScreen() {
  const nav = useNav();
  const { cerrarSesion } = useAuth();

  return (
    <Screen>
      <Title>Ajustes</Title>

      <Text style={styles.grupo}>Cuenta</Text>
      <LinkButton title="Mi perfil" onPress={() => nav.go('Perfil')} />

      <Text style={styles.grupo}>Hogar</Text>
      <LinkButton title="Categorías de movimiento" onPress={() => nav.go('Categorias')} />
      <LinkButton title="Tipos de cambio" onPress={() => nav.go('TiposCambio')} />

      <Text style={styles.grupo}>Sesión</Text>
      <LinkButton title="Cerrar sesión" onPress={cerrarSesion} />
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 12, textTransform: 'uppercase' },
});
