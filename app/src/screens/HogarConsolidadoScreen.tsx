import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type MetricasHogarDTO,
  type PatrimonioConsolidadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { colors, ErrorText, ProgressBar, Row, Screen, Title } from '../ui';

export function HogarConsolidadoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const hogarId = nav.route.params?.hogarId as string;

  const [cons, setCons] = useState<PatrimonioConsolidadoDTO | null>(null);
  const [met, setMet] = useState<MetricasHogarDTO | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [c, m] = await Promise.all([
        api.get<PatrimonioConsolidadoDTO>(`/hogares/${hogarId}/patrimonio-consolidado`, token),
        api.get<MetricasHogarDTO>(`/hogares/${hogarId}/metricas`, token),
      ]);
      setCons(c);
      setMet(m);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [hogarId, token]);

  useCargaAlEnfocar(cargar);

  if (!cons || !met) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <Title>Patrimonio del hogar</Title>
      <Text style={styles.muted}>
        {cons.elementos} elementos consolidados · {cons.miembros} miembros.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Total ({cons.monedaConsolidacion})</Text>
        {cons.total != null ? (
          <Text style={styles.total}>{money(cons.total, cons.monedaConsolidacion)}</Text>
        ) : (
          <Text style={styles.muted}>
            Falta tipo de cambio para: {cons.conversionesFaltantes.join(', ')}. Regístralo
            en "Tipos de cambio".
          </Text>
        )}
      </View>

      {cons.porMoneda.map((pm) => {
        const metricas = met.porMoneda.find((x) => x.moneda === pm.moneda);
        return (
          <View key={pm.moneda} style={styles.card}>
            <Text style={styles.sectionTitle}>{pm.moneda}</Text>
            <Row left="Patrimonio neto" right={money(pm.patrimonioNeto, pm.moneda)} />
            <Row left="Activos" right={money(pm.activos, pm.moneda)} />
            <Row left="Pasivos" right={money(pm.pasivos, pm.moneda)} />
            <Row left="Valor líquido" right={money(pm.valorLiquido, pm.moneda)} />
            {metricas?.liquidez != null && (
              <Row left="Liquidez" right={`${Math.round(metricas.liquidez * 100)}%`} />
            )}

            {metricas && metricas.distribucionPorActivo.length > 0 && (
              <>
                <Text style={styles.subTitle}>Distribución de activos</Text>
                {metricas.distribucionPorActivo.map((d) => (
                  <Row
                    key={d.categoria}
                    left={d.categoria}
                    right={`${money(d.valor, pm.moneda)} · ${d.porcentaje}%`}
                  />
                ))}
              </>
            )}
            {metricas && metricas.distribucionPorPasivo.length > 0 && (
              <>
                <Text style={styles.subTitle}>Distribución de pasivos</Text>
                {metricas.distribucionPorPasivo.map((d) => (
                  <Row
                    key={d.categoria}
                    left={d.categoria}
                    right={`${money(d.valor, pm.moneda)} · ${d.porcentaje}%`}
                  />
                ))}
              </>
            )}
          </View>
        );
      })}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Objetivos del hogar</Text>
        <Row
          left="Objetivos"
          right={`${met.objetivos.total} (${met.objetivos.enProgreso} en progreso, ${met.objetivos.completados} completados)`}
        />
        {met.objetivos.avancePorcentaje != null && (
          <>
            <ProgressBar pct={met.objetivos.avancePorcentaje} />
            <Text style={styles.muted}>
              {money(met.objetivos.progresoTotal, 'CLP')} de{' '}
              {money(met.objetivos.montoObjetivoTotal, 'CLP')} · {met.objetivos.avancePorcentaje}%
            </Text>
          </>
        )}
      </View>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  subTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 8 },
  muted: { fontSize: 13, color: colors.muted },
  total: { fontSize: 22, fontWeight: '800', color: colors.text },
});
