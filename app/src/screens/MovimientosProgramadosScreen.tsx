import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type MovimientoProgramadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Button,
  colors,
  DateField,
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Screen,
  SelectRow,
  Title,
} from '../ui';

export function MovimientosProgramadosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [lista, setLista] = useState<MovimientoProgramadoDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [obs, setObs] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [movs, els] = await Promise.all([
        api.get<MovimientoProgramadoDTO[]>('/movimientos-programados', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      setLista(movs);
      setElementos(els);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const destino = elementos.find((e) => e.id === destinoId);

  const crear = async () => {
    if (!destino) return;
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearMovimientoProgramado',
        {
          montoPlanificado: Number(monto),
          moneda: destino.moneda,
          fechaProgramada: fecha.trim(),
          elementoDestinoId: destino.id,
          ...(obs.trim() ? { observaciones: obs.trim() } : {}),
        },
        token,
      );
      toast.mostrar('Movimiento programado');
      setMonto('');
      setFecha('');
      setObs('');
      setDestinoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim());

  return (
    <Screen onRefresh={cargar}>
      <Title>Movimientos programados</Title>

      {lista === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          titulo="No tienes movimientos programados"
          descripcion="Un movimiento programado es un ingreso futuro con fecha (un sueldo, un arriendo por cobrar). Al llegar la fecha lo materializas."
        />
      ) : (
        lista.map((m) => (
          <Pressable
            key={m.id}
            style={styles.card}
            onPress={() => nav.go('MovimientoProgramadoDetalle', { movimientoId: m.id })}
          >
            <View style={styles.head}>
              <Text style={styles.nombre}>{money(m.montoPlanificado, m.moneda)}</Text>
              <Text style={styles.estado}>{etiqueta(m.estado)}</Text>
            </View>
            <Text style={styles.muted}>Programado para {fechaLegible(m.fechaProgramada)}</Text>
            {m.observaciones ? <Text style={styles.muted}>{m.observaciones}</Text> : null}
          </Pressable>
        ))
      )}

      <View style={styles.card}>
        <Text style={styles.nombre}>Nuevo movimiento programado</Text>
        <MoneyField label="Monto planificado" value={monto} onChange={setMonto} moneda={destino?.moneda} />
        <DateField label="Fecha" value={fecha} onChange={setFecha} />
        <Text style={styles.label}>Elemento destino</Text>
        {elementos.map((el) => (
          <SelectRow
            key={el.id}
            label={`${el.nombre} · ${el.moneda}`}
            selected={destinoId === el.id}
            onPress={() => setDestinoId(el.id)}
          />
        ))}
        <Field label="Observaciones (opcional)" value={obs} onChangeText={setObs} autoCapitalize="sentences" />
        <Button
          title="Programar"
          onPress={crear}
          loading={busy}
          disabled={!(Number(monto) > 0) || !fechaValida || !destinoId}
        />
      </View>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.text },
  estado: { fontSize: 12, fontWeight: '600', color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
});
