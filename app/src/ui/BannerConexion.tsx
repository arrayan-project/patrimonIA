import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useConexion } from '../api/useConexion';
import { colors } from './index';

/**
 * Barra fija arriba cuando se pierde la conexión con el servidor (E7).
 * "Reintentar" hace un ping a /health; si responde, la barra desaparece sola.
 */
export function BannerConexion() {
  const enLinea = useConexion();
  const insets = useSafeAreaInsets();
  const [probando, setProbando] = useState(false);

  if (enLinea) return null;

  const reintentar = async () => {
    setProbando(true);
    try {
      await api.get('/health');
    } catch {
      // el estado de red se actualiza solo dentro del cliente
    } finally {
      setProbando(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.primaryText} />
      <Text style={styles.texto}>Sin conexión. Revisa tu internet.</Text>
      <Pressable onPress={reintentar} hitSlop={8} accessibilityRole="button" disabled={probando}>
        {probando ? (
          <ActivityIndicator color={colors.primaryText} size="small" />
        ) : (
          <Text style={styles.accion}>Reintentar</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.danger,
  },
  texto: { flex: 1, color: colors.primaryText, fontSize: 13, fontWeight: '600' },
  accion: { color: colors.primaryText, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
});
