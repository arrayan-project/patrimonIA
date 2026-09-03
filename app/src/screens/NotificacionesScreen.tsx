import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type NotificacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, colors, ErrorText, LinkButton, Screen, Title } from '../ui';

export function NotificacionesScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [lista, setLista] = useState<NotificacionDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<NotificacionDTO[]>('/usuarios/me/notificaciones', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const leer = async (id: string) => {
    try {
      await api.post(`/usuarios/me/notificaciones/${id}/leer`, undefined, token);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  };

  const leerTodas = async () => {
    try {
      await api.post('/usuarios/me/notificaciones/leer-todas', undefined, token);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Notificaciones</Title>

      {lista === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : lista.length === 0 ? (
        <Text style={styles.muted}>Sin notificaciones.</Text>
      ) : (
        <>
          {lista.some((n) => !n.leida) && (
            <Button title="Marcar todas como leídas" variant="secondary" onPress={leerTodas} />
          )}
          {lista.map((n) => (
            <Pressable
              key={n.id}
              style={[styles.card, !n.leida && styles.noLeida]}
              onPress={() => !n.leida && leer(n.id)}
            >
              <Text style={styles.titulo}>{n.titulo}</Text>
              <Text style={styles.cuerpo}>{n.cuerpo}</Text>
              <Text style={styles.muted}>
                {n.createdAt.slice(0, 10)}
                {!n.leida ? ' · nueva (toca para marcar leída)' : ''}
              </Text>
            </Pressable>
          ))}
        </>
      )}

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 4 },
  noLeida: { borderColor: colors.primary, backgroundColor: colors.faint },
  titulo: { fontSize: 15, fontWeight: '700', color: colors.text },
  cuerpo: { fontSize: 14, color: colors.text },
  muted: { fontSize: 12, color: colors.muted },
});
