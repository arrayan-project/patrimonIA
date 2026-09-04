import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ObjetivoFinancieroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  Card,
  colors,
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  MoneyField,
  ProgressBar,
  Skeleton,
  Screen,
  Title,
  panel,
  tipo,
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

      <Ayuda>
        Un objetivo es una meta de ahorro (el pie de una vivienda, un viaje).
        Adentro creas asignaciones y les guardas reservas de dinero para ir
        viendo el avance.
      </Ayuda>

      {objetivos === null ? (
        <Skeleton />
      ) : objetivos.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          titulo="Aún no tienes objetivos"
          descripcion="Créalo abajo y luego asígnale reservas."
        />
      ) : (
        (() => {
          const enProgreso = objetivos.filter((o) => o.estado === 'EN_PROGRESO');
          const meta = enProgreso.reduce((s, o) => s + o.montoObjetivo, 0);
          const avance = enProgreso.reduce((s, o) => s + o.progreso, 0);
          const pct = meta > 0 ? Math.round((avance / meta) * 100) : 0;
          return enProgreso.length > 1 ? (
            <View style={styles.card}>
              <Text style={styles.nombre}>Avance total ({enProgreso.length} objetivos activos)</Text>
              <ProgressBar pct={pct} />
              <Text style={styles.muted}>
                {money(avance, 'CLP')} de {money(meta, 'CLP')} · {pct}%
              </Text>
            </View>
          ) : null;
        })()
      )}

      {objetivos !== null &&
        objetivos.length > 0 &&
        objetivos.map((o) => (
          <Card key={o.id} onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}>
            <View style={styles.head}>
              <Text style={styles.nombre}>{o.nombre}</Text>
              <Text style={styles.estado}>{etiqueta(o.estado)}</Text>
            </View>
            <ProgressBar pct={o.progresoPorcentaje} />
            <Text style={styles.muted}>
              {money(o.progreso, 'CLP')} de {money(o.montoObjetivo, 'CLP')} · {o.progresoPorcentaje}%
            </Text>
          </Card>
        ))}

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
  card: { ...panel, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.text },
  estado: { fontSize: 12, fontWeight: '600', color: colors.muted },
  muted: tipo.nota,
});
