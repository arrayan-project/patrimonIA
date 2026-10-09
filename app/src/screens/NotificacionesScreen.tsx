import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type NotificacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { EmptyState, ErrorText, fechaRelativa, radio, Screen, Section, Skeleton, useC, type Paleta } from '../ui';
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
    // D-6: "¿Se pagó?" se responde en el detalle del programado.
    case 'MOVIMIENTO_PROGRAMADO':
      return { name: 'MovimientoProgramadoDetalle', params: { movimientoId: n.entidadId } };
    case 'EVENTO_FINANCIERO':
      return { name: 'MovimientoDetalle', params: { eventoId: n.entidadId } };
    // G33 bloque 9: lo que te piden se responde ahí; lo que pediste muestra su estado.
    case 'SOLICITUD_TRANSFERENCIA':
      return { name: 'PagarSolicitud', params: { solicitudId: n.entidadId } };
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
      {lista === null ? (
        <Skeleton />
      ) : lista.length === 0 ? (
        <EmptyState icon="notifications-off-outline" titulo="Sin notificaciones" descripcion="Te avisamos cuando completes una meta, se use plata de una meta o te inviten a un hogar." />
      ) : (
        <Section
          title="Avisos"
          accion="Marcar todas como leídas"
          onAccion={lista.some((n) => !n.leida) ? leerTodas : undefined}
        >
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
                <View style={styles.cabeza}>
                  {!n.leida ? <View style={styles.punto} /> : null}
                  <Text style={styles.titulo}>{n.titulo}</Text>
                </View>
                <Text style={styles.cuerpo}>{n.cuerpo}</Text>
                <Text style={styles.muted}>
                  {fechaRelativa(n.createdAt)}
                  {!n.leida ? ' · nueva' : ''}
                  {d ? ' · toca para abrir' : ''}
                </Text>
              </Pressable>
            );
          })}
        </Section>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  card: {
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radio.tarjeta,
    padding: 14,
    gap: 3,
  },
  noLeida: { borderColor: c.mutedDim },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  titulo: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  cuerpo: { fontSize: 13, color: c.muted },
  muted: { fontSize: 12, color: c.muted },
});
