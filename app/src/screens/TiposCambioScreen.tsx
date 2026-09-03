import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type TipoCambioDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  Button,
  colors,
  DateField,
  ErrorText,
  Field,
  fechaLegible,
  LinkButton,
  Row,
  Skeleton,
  Screen,
  Title,
} from '../ui';

export function TiposCambioScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [lista, setLista] = useState<TipoCambioDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [origen, setOrigen] = useState('USD');
  const [destino, setDestino] = useState('CLP');
  const [tasa, setTasa] = useState('');
  const [fecha, setFecha] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<TipoCambioDTO[]>('/tipos-cambio', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const registrar = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/RegistrarTipoCambio',
        {
          monedaOrigen: origen.trim().toUpperCase(),
          monedaDestino: destino.trim().toUpperCase(),
          tasa: Number(tasa),
          ...(fecha.trim() ? { fechaVigencia: fecha.trim() } : {}),
        },
        token,
      );
      toast.mostrar('Tipo de cambio registrado');
      setTasa('');
      setFecha('');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Tipos de cambio</Title>
      <Text style={styles.muted}>
        1 unidad de la moneda origen = tasa unidades de la destino. Se conservan
        históricamente; la conversión usa la más reciente vigente a la fecha.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Registrar tasa</Text>
        <Field label="Moneda origen" value={origen} onChangeText={setOrigen} maxLength={3} />
        <Field label="Moneda destino" value={destino} onChangeText={setDestino} maxLength={3} />
        <Field label="Tasa" keyboardType="numeric" value={tasa} onChangeText={setTasa} placeholder="950" />
        <DateField label="Vigente desde (opcional, por defecto hoy)" value={fecha} onChange={setFecha} optional />
        <Button
          title="Registrar"
          onPress={registrar}
          loading={busy}
          disabled={!(Number(tasa) > 0) || origen.trim().length !== 3 || destino.trim().length !== 3}
        />
      </View>

      {lista === null ? (
        <Skeleton />
      ) : lista.length === 0 ? (
        <Text style={styles.muted}>Sin tipos de cambio registrados.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Registradas</Text>
          {lista.map((t) => (
            <Row
              key={t.id}
              left={`${t.monedaOrigen} → ${t.monedaDestino} · ${fechaLegible(t.fechaVigencia)}`}
              right={String(t.tasa)}
            />
          ))}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
});
