import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type ObjetivoFinancieroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Button, colors, ErrorText, Field, LinkButton, ProgressBar, Screen, Title } from '../ui';

export function ObjetivosScreen() {
  const { token } = useSession();
  const nav = useNav();
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

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearObjetivoFinanciero',
        { nombre: nombre.trim(), montoObjetivo: Number(monto) },
        token,
      );
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
    <Screen>
      <Title>Objetivos financieros</Title>

      {objetivos === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        objetivos.map((o) => (
          <Pressable
            key={o.id}
            style={styles.card}
            onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
          >
            <View style={styles.head}>
              <Text style={styles.nombre}>{o.nombre}</Text>
              <Text style={styles.estado}>{o.estado}</Text>
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
        <Field label="Monto objetivo" keyboardType="numeric" value={monto} onChangeText={setMonto} placeholder="10000000" />
        <Button title="Crear objetivo" onPress={crear} loading={busy} disabled={!nombre.trim() || !(Number(monto) > 0)} />
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Actualizar" onPress={() => void cargar()} />
      <LinkButton title="Volver" onPress={nav.back} />
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
