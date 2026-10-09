import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { panelDe, Screen, tinte, useC, type Paleta } from '../ui';
import { EnlaceAcceso } from '../ui/acceso';
import { Text } from '../ui/Text';

/** G35 tanda 6: sin hogar, dos tarjetas grandes en vez de botones y párrafos. */
export function BienvenidaScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const nav = useNav();
  const { session, cerrarSesion } = useAuth();

  const opcion = (emoji: string, titulo: string, sub: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.circulo}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );

  return (
    <Screen pie={<EnlaceAcceso title="🚪 Cerrar sesión" onPress={cerrarSesion} />}>
      <Text style={styles.hola} accessibilityRole="header">
        👋 Hola, {session?.usuario.nombre}
      </Text>
      <Text style={styles.pregunta}>¿Cómo quieres empezar?</Text>

      {opcion('🏠', 'Crear mi hogar', 'Aunque vivas solo: ahí se ordena tu plata', () =>
        nav.go('CrearHogar'),
      )}
      {opcion('✉️', 'Me invitaron', 'Únete al hogar de otra persona', () => nav.go('Invitaciones'))}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    hola: { fontSize: 28, fontWeight: '800', color: c.text, marginTop: 12 },
    pregunta: { fontSize: 16, color: c.muted, marginBottom: 8 },
    tarjeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 88,
      ...panelDe(c),
    },
    circulo: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tinte(c.primary, 0.14),
    },
    emoji: { fontSize: 26 },
    titulo: { fontSize: 17, fontWeight: '800', color: c.text },
    sub: { fontSize: 13, color: c.muted },
    chev: { fontSize: 26, color: c.mutedDim },
  });
