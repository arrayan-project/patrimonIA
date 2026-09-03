import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { colors, ErrorText, LinkButton, Row, Screen, Title } from '../ui';

export function ElementoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string | undefined;

  const [elemento, setElemento] = useState<ElementoPatrimonialDTO | null>(null);
  const [eventos, setEventos] = useState<EventoFinancieroDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!elementoId) return;
    setError('');
    try {
      const [el, evs] = await Promise.all([
        api.get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token),
        api.get<EventoFinancieroDTO[]>(`/eventos-financieros?elemento=${elementoId}`, token),
      ]);
      setElemento(el);
      setEventos(evs);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, token]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!elemento) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
        <LinkButton title="Volver" onPress={nav.back} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{elemento.nombre}</Title>
      <Text style={styles.valor}>{money(elemento.valorVigente, elemento.moneda)}</Text>

      <View style={styles.card}>
        <Row left="Categoría" right={elemento.categoriaFuncional} />
        <Row left="Tipo" right={elemento.tipo} />
        <Row left="Ámbito" right={elemento.ambito} />
        <Row left="Visibilidad" right={elemento.visibilidad} />
        <Row left="Estado" right={elemento.estado} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Propietarios</Text>
        {elemento.propietarios.map((p) => (
          <Row key={p.usuarioId} left={p.nombre ?? p.usuarioId} right={`${p.porcentaje}%`} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Movimientos</Text>
        {eventos.length === 0 ? (
          <Text style={styles.muted}>Sin movimientos.</Text>
        ) : (
          eventos.map((ev) => {
            const impacto = ev.impactos.find((i) => i.elementoId === elementoId);
            const etiqueta = ev.anulado
              ? 'anulado'
              : ev.correccionDeId
                ? 'corrección'
                : ev.fecha;
            return (
              <Pressable
                key={ev.id}
                style={styles.mov}
                onPress={() =>
                  nav.go('MovimientoDetalle', { eventoId: ev.id, elementoId })
                }
              >
                <View>
                  <Text style={[styles.movTipo, ev.anulado && styles.tachado]}>{ev.tipo}</Text>
                  <Text style={styles.muted}>{etiqueta}</Text>
                </View>
                <Text
                  style={[
                    styles.movMonto,
                    ev.anulado
                      ? styles.tachado
                      : { color: (impacto?.monto ?? 0) < 0 ? colors.danger : colors.primary },
                  ]}
                >
                  {money(impacto?.monto ?? ev.monto, ev.moneda)}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Actualizar" onPress={() => void cargar()} />
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  valor: { fontSize: 28, fontWeight: '800', color: colors.text },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 13, color: colors.muted },
  mov: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.faint,
    paddingVertical: 10,
  },
  movTipo: { fontSize: 14, fontWeight: '600', color: colors.text },
  movMonto: { fontSize: 15, fontWeight: '700' },
  tachado: { textDecorationLine: 'line-through', color: colors.muted },
});
