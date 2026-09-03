import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ObjetivoFinancieroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Button,
  colors,
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  MoneyField,
  ProgressBar,
  Screen,
  Title,
} from '../ui';

export function ObjetivosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setObjetivos(await api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const crear = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearObjetivoFinanciero',
        { nombre: nombre.trim(), montoObjetivo: Number(monto) },
        token,
      );
      toast.mostrar('Objetivo creado');
      setNombre('');
      setMonto('');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Objetivos financieros</Title>

      {objetivos === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : objetivos.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          titulo="Aún no tienes objetivos"
          descripcion="Un objetivo es una meta de ahorro (el pie de una vivienda, un viaje). Créalo abajo y luego asígnale reservas."
        />
      ) : (
        objetivos.map((o) => (
          <Pressable
            key={o.id}
            style={styles.card}
            onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
          >
            <View style={styles.head}>
              <Text style={styles.nombre}>{o.nombre}</Text>
              <Text style={styles.estado}>{etiqueta(o.estado)}</Text>
            </View>
            <ProgressBar pct={o.progresoPorcentaje} />
            <Text style={styles.muted}>
              {money(o.progreso, 'CLP')} de {money(o.montoObjetivo, 'CLP')} · {o.progresoPorcentaje}%
            </Text>
          </Pressable>
        ))
      )}

      <View style={styles.card}>
        <Text style={styles.nombre}>Nuevo objetivo</Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" placeholder="Pie vivienda" />
        <MoneyField label="Monto objetivo" value={monto} onChange={setMonto} />
        <Button title="Crear objetivo" onPress={crear} loading={busy} disabled={!nombre.trim() || !(Number(monto) > 0)} />
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
});
