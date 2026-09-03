import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
  type HogarDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  aISO,
  Button,
  colors,
  DateField,
  ErrorText,
  Field,
  LinkButton,
  MoneyField,
  Paragraph,
  Screen,
  Segmented,
  SelectRow,
  Title,
} from '../ui';

const TIPOS = ['INGRESO', 'GASTO', 'TRANSFERENCIA', 'CONVERSION'] as const;
type Tipo = (typeof TIPOS)[number];

export function RegistrarMovimientoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [tipo, setTipo] = useState<Tipo>('GASTO');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(aISO(new Date()));
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [glosa, setGlosa] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
      .then(setElementos)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) =>
        hs[0]
          ? api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hs[0].id}/categorias-movimiento`,
              token,
            )
          : [],
      )
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [token]);

  const necesitaOrigen = tipo === 'GASTO' || tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION';
  const necesitaDestino = tipo === 'INGRESO' || tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION';
  const puedeCategorizar = tipo === 'INGRESO' || tipo === 'GASTO';
  const categoriasAplicables = categorias.filter(
    (c) => c.tipoAplicable === 'AMBOS' || c.tipoAplicable === tipo,
  );

  const monedaEvento = useMemo(() => {
    const ref = elementos?.find((e) => e.id === (necesitaOrigen ? origenId : destinoId));
    return ref?.moneda ?? 'CLP';
  }, [elementos, origenId, destinoId, necesitaOrigen]);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.comando<EventoFinancieroDTO>(
        '/comandos/RegistrarEventoFinanciero',
        {
          tipo,
          monto: Number(monto),
          moneda: monedaEvento,
          fecha,
          ...(necesitaOrigen && origenId ? { elementoOrigenId: origenId } : {}),
          ...(necesitaDestino && destinoId ? { elementoDestinoId: destinoId } : {}),
          ...(puedeCategorizar && categoriaId ? { categoriaId } : {}),
          ...(glosa.trim() ? { glosa: glosa.trim() } : {}),
        },
        token,
        key,
      );
      toast.mostrar('Movimiento registrado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!elementos) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const puedeEnviar =
    Number(monto) > 0 &&
    (!necesitaOrigen || !!origenId) &&
    (!necesitaDestino || !!destinoId) &&
    origenId !== destinoId;

  return (
    <Screen>
      <Title>Registrar movimiento</Title>
      <Segmented label="Tipo" options={TIPOS} value={tipo} onChange={setTipo} />
      {tipo === 'CONVERSION' && (
        <Paragraph>
          Cambio de moneda: el monto va en la moneda del origen; el destino recibe el
          equivalente según el tipo de cambio vigente. Necesitas la tasa registrada.
        </Paragraph>
      )}
      <MoneyField label="Monto" value={monto} onChange={setMonto} moneda={monedaEvento} />
      <DateField label="Fecha" value={fecha} onChange={setFecha} />
      <Field
        label="Detalle (opcional)"
        value={glosa}
        onChangeText={setGlosa}
        placeholder="p. ej. pago internet marzo"
        autoCapitalize="sentences"
        maxLength={140}
      />

      {puedeCategorizar && categoriasAplicables.length > 0 && (
        <View style={styles.group}>
          <Text style={styles.label}>Categoría (opcional)</Text>
          <SelectRow
            label="Sin categoría"
            selected={categoriaId === null}
            onPress={() => setCategoriaId(null)}
          />
          {categoriasAplicables.map((c) => (
            <SelectRow
              key={c.id}
              label={c.nombre}
              selected={categoriaId === c.id}
              onPress={() => setCategoriaId(c.id)}
            />
          ))}
        </View>
      )}

      {necesitaOrigen && (
        <View style={styles.group}>
          <Text style={styles.label}>Elemento de origen</Text>
          {elementos.map((el) => (
            <SelectRow
              key={el.id}
              label={`${el.nombre} · ${money(el.valorVigente, el.moneda)}`}
              selected={origenId === el.id}
              onPress={() => setOrigenId(el.id)}
            />
          ))}
        </View>
      )}

      {necesitaDestino && (
        <View style={styles.group}>
          <Text style={styles.label}>Elemento de destino</Text>
          {elementos.map((el) => (
            <SelectRow
              key={el.id}
              label={`${el.nombre} · ${money(el.valorVigente, el.moneda)}`}
              selected={destinoId === el.id}
              onPress={() => setDestinoId(el.id)}
            />
          ))}
          {tipo === 'TRANSFERENCIA' && (
            <Paragraph>
              El destino puede ser de otro miembro de tu hogar (Fase 2 solo lista tus elementos).
            </Paragraph>
          )}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar" onPress={onSubmit} loading={loading} disabled={!puedeEnviar} />
      {nav.canGoBack && <LinkButton title="Volver" onPress={nav.back} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
});
