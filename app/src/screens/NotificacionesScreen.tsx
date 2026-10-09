import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type NotificacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { EmptyState, ErrorText, fechaRelativa, ListCard, Pastilla, Screen, Section, Skeleton, tinte, tipografia, useC, type Paleta } from '../ui';
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

  const nuevos = lista?.filter((n) => !n.leida) ?? [];
  const vistos = lista?.filter((n) => n.leida) ?? [];

  const fila = (n: NotificacionDTO, i: number) => {
    const d = destino(n);
    return (
      <Pressable
        key={n.id}
        style={({ pressed }) => [styles.fila, i > 0 && styles.separada, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={`${n.titulo}. ${n.cuerpo}${!n.leida ? '. Nuevo' : ''}`}
        onPress={() => {
          if (!n.leida) void leer(n.id);
          if (d) nav.go(d.name, d.params);
        }}
      >
        <View style={[styles.emoji, !n.leida && styles.emojiNuevo]}>
          <Text style={styles.emojiTxt}>{emojiDe(n)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cabeza}>
            <Text style={[styles.titulo, !n.leida && styles.tituloNuevo]} numberOfLines={2}>
              {n.titulo}
            </Text>
            <Text style={styles.fecha}>{fechaRelativa(n.createdAt)}</Text>
          </View>
          <Text style={styles.cuerpo}>{n.cuerpo}</Text>
        </View>
        {d ? <Text style={styles.chev}>›</Text> : null}
      </Pressable>
    );
  };

  return (
    <Screen onRefresh={cargar}>
      {lista === null ? (
        <Skeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          emoji="🔕"
          titulo="Nada nuevo por ahora"
          descripcion="Te avisamos cuando te pidan tu parte de un gasto, toque pagar algo programado o completes una meta."
        />
      ) : (
        <>
          {nuevos.length > 0 && (
            <View style={styles.grupo}>
              <View style={styles.grupoCabeza}>
                <Text style={styles.rotulo} accessibilityRole="header">
                  🔔 Nuevos
                </Text>
                <Pastilla label="✅ Marcar todo como leído" onPress={leerTodas} />
              </View>
              <ListCard>{nuevos.map(fila)}</ListCard>
            </View>
          )}
          {vistos.length > 0 && (
            <Section title="Ya vistos">
              <ListCard>{vistos.map(fila)}</ListCard>
            </Section>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** G35: el emoji de cada aviso, según qué lo generó. */
function emojiDe(n: NotificacionDTO): string {
  switch (n.tipo) {
    case 'SOLICITUD_APORTE':
      return '🧾';
    case 'SOLICITUD_PAGADA':
    case 'AVISO_TRANSFERENCIA':
      return '🔁';
    case 'SOLICITUD_RECHAZADA':
      return '🙅';
    case 'PROGRAMADO_VENCIDO':
      return '🗓️';
    case 'OBJETIVO_COMPLETADO':
      return '🎉';
    case 'RESERVA_CONSUMIDA':
      return '🐷';
    case 'INVITACION_RECIBIDA':
      return '✉️';
    default:
      return '🔔';
  }
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  grupo: { gap: 8, marginTop: 8 },
  grupoCabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rotulo: { ...tipografia.seccion, color: c.text },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 64 },
  separada: { borderTopWidth: 1, borderTopColor: c.border },
  emoji: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.panelAlt, alignItems: 'center', justifyContent: 'center' },
  emojiNuevo: { backgroundColor: tinte(c.primary, 0.2) },
  emojiTxt: { fontSize: 20 },
  cabeza: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titulo: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  tituloNuevo: { fontWeight: '800' },
  fecha: { fontSize: 12, color: c.muted, marginTop: 2 },
  cuerpo: { fontSize: 13, color: c.muted, marginTop: 2 },
  chev: { fontSize: 22, color: c.mutedDim },
});
