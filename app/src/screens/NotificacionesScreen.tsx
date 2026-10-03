import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type NotificacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, EmptyState, ErrorText, fechaRelativa, Screen, Skeleton, Title, panel, useC, type Paleta } from '../ui';
import type { RouteName } from '../navigation/navigator';

/** entidadTipo de una notificación → a qué pantalla lleva. */
function destino(n: NotificacionDTO): { name: RouteName; params?: Record<string, unknown> } | null {
  if (!n.entidadId) return null;
  switch (n.entidadTipo) {
    case 'OBJETIVO_FINANCIERO':
      return { name: 'ObjetivoDetalle', params: { objetivoId: n.entidadId } };
    case 'ASIGNACION':
      return { name: 'AsignacionDetalle', params: { asignacionId: n.entidadId } };
    case 'INVITACION':
      return { name: 'Invitaciones' };
    case 'EVENTO_FINANCIERO':
      return { name: 'MovimientoDetalle', params: { eventoId: n.entidadId } };
    default:
      return null;
  }
}

export function NotificacionesScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
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
        <Skeleton />
      ) : lista.length === 0 ? (
        <EmptyState icon="notifications-off-outline" titulo="Sin notificaciones" descripcion="Te avisamos cuando completes una meta, se use plata de una meta o te inviten a un hogar." />
      ) : (
        <>
          {lista.some((n) => !n.leida) && (
            <Button title="Marcar todas como leídas" variant="secondary" onPress={leerTodas} />
          )}
          {lista.map((n) => {
            const d = destino(n);
            return (
              <Pressable
                key={n.id}
                style={[styles.card, !n.leida && styles.noLeida]}
                accessibilityRole="button"
                accessibilityLabel={`${n.titulo}. ${n.cuerpo}${!n.leida ? '. Nueva' : ''}`}
                onPress={() => {
                  if (!n.leida) void leer(n.id);
                  if (d) nav.go(d.name, d.params);
                }}
              >
                <Text style={styles.titulo}>{n.titulo}</Text>
                <Text style={styles.cuerpo}>{n.cuerpo}</Text>
                <Text style={styles.muted}>
                  {fechaRelativa(n.createdAt)}
                  {!n.leida ? ' · nueva' : ''}
                  {d ? ' · toca para abrir' : ''}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  card: { ...panel, gap: 4 },
  noLeida: { borderColor: c.primary, backgroundColor: c.info },
  titulo: { fontSize: 15, fontWeight: '700', color: c.text },
  cuerpo: { fontSize: 14, color: c.text },
  muted: { fontSize: 12, color: c.muted },
});
