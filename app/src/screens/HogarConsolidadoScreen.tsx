import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import {
  Skeleton,
  colorCategoria,
  ErrorText,
  etiqueta,
  Hero,
  MoneyText,
  Nota,
  ProgressBar,
  Row,
  Screen,
  Section,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';
import { Dona } from '../ui/charts';

export function HogarConsolidadoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
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
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <Hero
        label={`Total del hogar (${cons.monedaConsolidacion})`}
        value={cons.total != null ? money(cons.total, cons.monedaConsolidacion) : '—'}
        substats={[
          { label: 'Elementos', value: String(cons.elementos) },
          { label: 'Miembros', value: String(cons.miembros) },
        ]}
      />
      {cons.total == null && (
        <Nota>
          Falta tipo de cambio para: {cons.conversionesFaltantes.join(', ')}. Regístralo en "Tipos
          de cambio".
        </Nota>
      )}

      {cons.porMoneda.map((pm) => {
        const metricas = met.porMoneda.find((x) => x.moneda === pm.moneda);
        return (
          <Section key={pm.moneda} title={`En ${pm.moneda}`}>
            <Panel>
              <Row
                left="Patrimonio neto"
                right={<MoneyText monto={pm.patrimonioNeto} moneda={pm.moneda} style={styles.montoRow} />}
              />
              <Row left="Activos" right={money(pm.activos, pm.moneda)} />
              <Row
                left="Pasivos"
                right={<MoneyText monto={pm.pasivos} moneda={pm.moneda} style={styles.montoRow} />}
              />
              <Row
                left="Valor líquido"
                right={<MoneyText monto={pm.valorLiquido} moneda={pm.moneda} style={styles.montoRow} />}
              />
              {metricas?.liquidez != null && (
                <Row left="Liquidez" right={`${Math.round(metricas.liquidez * 100)}%`} />
              )}

              {metricas && metricas.distribucionPorActivo.length > 0 && (
                <>
                  <Text style={styles.subTitle}>Distribución de activos</Text>
                  <Dona
                    segmentos={metricas.distribucionPorActivo.map((d, i) => ({
                      label: etiqueta(d.categoria),
                      valor: d.valor,
                      color: colorCategoria(null, i),
                    }))}
                    centro={money(pm.activos, pm.moneda).replace(` ${pm.moneda}`, '')}
                    formatoValor={(n) => money(n, pm.moneda)}
                  />
                </>
              )}
              {metricas && metricas.distribucionPorPasivo.length > 0 && (
                <>
                  <Text style={styles.subTitle}>Distribución de pasivos</Text>
                  {metricas.distribucionPorPasivo.map((d) => (
                    <Row
                      key={d.categoria}
                      left={etiqueta(d.categoria)}
                      right={`${money(d.valor, pm.moneda)} · ${d.porcentaje}%`}
                    />
                  ))}
                </>
              )}
            </Panel>
          </Section>
        );
      })}

      <Section title="Metas del hogar">
        <Panel>
          <Row
            left="Metas"
            right={`${met.objetivos.total} (${met.objetivos.enProgreso} en progreso, ${met.objetivos.completados} completadas)`}
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
        </Panel>
      </Section>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  subTitle: { fontSize: 13, fontWeight: '700', color: c.muted, marginTop: 8 },
  muted: tipoDe(c).nota,
  montoRow: { fontSize: 14, fontWeight: '600' },
});
