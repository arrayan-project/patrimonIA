import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type VariacionPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Button, colors, DateField, ErrorText, fechaLegible, LinkButton, Row, Screen, Title } from '../ui';

export function EvolucionPatrimonioScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState<VariacionPatrimonialDTO | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fechaOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

  const consultar = async () => {
    setBusy(true);
    setError('');
    try {
      const q = new URLSearchParams({ desde: desde.trim() });
      if (fechaOk(hasta)) q.set('hasta', hasta.trim());
      setData(
        await api.get<VariacionPatrimonialDTO>(`/usuarios/me/variacion-patrimonial?${q}`, token),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Evolución de mi patrimonio</Title>
      <Text style={styles.muted}>
        Reconstruye el patrimonio a dos fechas y muestra la variación. Sin fecha de
        fin, se usa hoy.
      </Text>

      <DateField label="Desde" value={desde} onChange={setDesde} />
      <DateField label="Hasta (opcional, por defecto hoy)" value={hasta} onChange={setHasta} optional />
      <Button title="Consultar" onPress={consultar} loading={busy} disabled={!fechaOk(desde)} />

      <ErrorText>{error}</ErrorText>

      {busy && <ActivityIndicator color={colors.primary} />}

      {data && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {fechaLegible(data.desde)} → {fechaLegible(data.hasta)}
          </Text>
          {data.porMoneda.length === 0 ? (
            <Text style={styles.muted}>Sin datos en ese período.</Text>
          ) : (
            data.porMoneda.map((m) => (
              <View key={m.moneda} style={styles.bloque}>
                <Row left={`Patrimonio (${m.moneda}) al inicio`} right={money(m.patrimonioDesde, m.moneda)} />
                <Row left="Al final" right={money(m.patrimonioHasta, m.moneda)} />
                <Row
                  left="Variación"
                  right={`${m.variacion >= 0 ? '+' : ''}${money(m.variacion, m.moneda)}${
                    m.variacionPorcentaje === null ? '' : ` (${m.variacionPorcentaje}%)`
                  }`}
                />
              </View>
            ))
          )}
        </View>
      )}

      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  bloque: { gap: 4, borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 8 },
});
