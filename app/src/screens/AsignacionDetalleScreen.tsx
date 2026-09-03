import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  Button,
  colors,
  ErrorText,
  Field,
  LinkButton,
  Row,
  Screen,
  SelectRow,
  Title,
} from '../ui';

export function AsignacionDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const asignacionId = nav.route.params?.asignacionId as string;

  const [asg, setAsg] = useState<AsignacionDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setAsg(await api.get<AsignacionDTO>(`/asignaciones/${asignacionId}`, token));
      setElementos(
        await api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [asignacionId, token]);

  useCargaAlEnfocar(cargar);

  const run = async (fn: () => Promise<unknown>, salir = false) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (salir) nav.back();
      else await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!asg) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
        <LinkButton title="Volver" onPress={nav.back} />
      </Screen>
    );
  }

  const nombrePorId = new Map(elementos.map((e) => [e.id, e.nombre]));
  const reservasActivas = (asg.reservas ?? []).filter((r) => r.estado === 'ACTIVA');

  return (
    <Screen onRefresh={cargar}>
      <Title>{asg.nombre}</Title>
      <Text style={styles.muted}>Total reservado: {money(asg.totalReservado, 'CLP')}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reservas activas</Text>
        {reservasActivas.length === 0 ? (
          <Text style={styles.muted}>Sin reservas.</Text>
        ) : (
          reservasActivas.map((r) => (
            <View key={r.id} style={styles.reserva}>
              <Row
                left={nombrePorId.get(r.elementoOrigenId) ?? 'Elemento'}
                right={money(r.monto, 'CLP')}
              />
              <Button
                title="Liberar"
                variant="secondary"
                loading={busy}
                disabled={motivo.trim().length < 3}
                onPress={() =>
                  run(() =>
                    api.post(
                      '/comandos/LiberarReserva',
                      { reservaId: r.id, motivo: motivo.trim() },
                      token,
                    ),
                  )
                }
              />
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nueva reserva</Text>
        {elementos.map((el) => (
          <SelectRow
            key={el.id}
            label={`${el.nombre} · ${money(el.valorVigente, el.moneda)}`}
            selected={origenId === el.id}
            onPress={() => setOrigenId(el.id)}
          />
        ))}
        <Field label="Monto a reservar" keyboardType="numeric" value={monto} onChangeText={setMonto} />
        <Button
          title="Crear reserva"
          loading={busy}
          disabled={!origenId || !(Number(monto) > 0)}
          onPress={() =>
            run(async () => {
              await api.post(
                '/comandos/CrearReserva',
                { asignacionId, elementoOrigenId: origenId, monto: Number(monto) },
                token,
              );
              setMonto('');
              setOrigenId(null);
            })
          }
        />
      </View>

      <View style={styles.card}>
        <Field label="Motivo (liberar / eliminar)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        <Button
          title="Eliminar asignación"
          variant="secondary"
          loading={busy}
          disabled={motivo.trim().length < 3}
          onPress={() =>
            run(
              () =>
                api.post(
                  '/comandos/EliminarAsignacion',
                  { asignacionId, motivo: motivo.trim() },
                  token,
                ),
              true,
            )
          }
        />
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  reserva: { gap: 6, borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 8 },
  muted: { fontSize: 13, color: colors.muted },
});
