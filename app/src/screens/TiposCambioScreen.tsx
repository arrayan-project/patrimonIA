import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type TipoCambioDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  Button,
  DateField,
  ErrorText,
  Field,
  fechaLegible,
  LinkButton,
  Row,
  Skeleton,
  Screen,
  Title,
  Panel,
  useC,
  tipoDe,
  type Paleta,
} from '../ui';

export function TiposCambioScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
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
  const [intento, setIntento] = useState(false);

  const errOrigen = origen.trim().length === 3 ? '' : 'Código de 3 letras (p. ej. USD).';
  const errDestino =
    destino.trim().length !== 3
      ? 'Código de 3 letras (p. ej. CLP).'
      : destino.trim().toUpperCase() === origen.trim().toUpperCase()
        ? 'La moneda destino no puede ser la misma.'
        : '';
  const errTasa = Number(tasa) > 0 ? '' : 'Ingresa una tasa mayor a 0.';

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
    setIntento(true);
    if (errOrigen || errDestino || errTasa) return;
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

      <Panel>
        <Text style={styles.sectionTitle}>Registrar tasa</Text>
        <Field
          label="Moneda origen"
          value={origen}
          onChangeText={setOrigen}
          maxLength={3}
          autoCapitalize="characters"
          error={intento ? errOrigen : undefined}
        />
        <Field
          label="Moneda destino"
          value={destino}
          onChangeText={setDestino}
          maxLength={3}
          autoCapitalize="characters"
          error={intento ? errDestino : undefined}
        />
        <Field
          label="Tasa"
          keyboardType="numeric"
          value={tasa}
          onChangeText={setTasa}
          placeholder="950"
          error={intento ? errTasa : undefined}
        />
        <DateField label="Vigente desde (opcional, por defecto hoy)" value={fecha} onChange={setFecha} optional />
        <Button title="Registrar" onPress={registrar} loading={busy} />
      </Panel>

      {lista === null ? (
        <Skeleton />
      ) : lista.length === 0 ? (
        <Text style={styles.muted}>Sin tipos de cambio registrados.</Text>
      ) : (
        <Panel>
          <Text style={styles.sectionTitle}>Registradas</Text>
          {lista.map((t) => (
            <Row
              key={t.id}
              left={`${t.monedaOrigen} → ${t.monedaDestino} · ${fechaLegible(t.fechaVigencia)}`}
              right={String(t.tasa)}
            />
          ))}
        </Panel>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
  muted: tipoDe(c).nota,
});
