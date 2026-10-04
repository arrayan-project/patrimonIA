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
        label="Plata del hogar"
        value={cons.total != null ? money(cons.total, cons.monedaConsolidacion) : '—'}
        substats={
          // Tienen − Deben = total; solo si cuadra (una moneda, la del hogar).
          cons.porMoneda.length === 1 &&
          cons.porMoneda[0].moneda === cons.monedaConsolidacion &&
          Math.abs(cons.porMoneda[0].activos - Math.abs(cons.porMoneda[0].pasivos) - cons.porMoneda[0].patrimonioNeto) < 1
            ? [
                { label: 'Tienen', value: money(cons.porMoneda[0].activos, cons.monedaConsolidacion) },
                { label: 'Deben', value: money(Math.abs(cons.porMoneda[0].pasivos), cons.monedaConsolidacion) },
              ]
            : undefined
        }
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
          <Section key={pm.moneda} title={cons.porMoneda.length > 1 ? `En ${pm.moneda}` : 'Cómo se compone'}>
            <Panel>
              {/* Con una sola moneda, total, tienen y deben ya están arriba. */}
              {cons.porMoneda.length > 1 && (
                <>
                  <Row
                    left="Total"
                    right={<MoneyText monto={pm.patrimonioNeto} moneda={pm.moneda} style={styles.montoRow} />}
                  />
                  <Row left="Tienen" right={money(pm.activos, pm.moneda)} />
                  <Row left="Deben" right={money(Math.abs(pm.pasivos), pm.moneda)} />
                </>
              )}
              <Row
                left="Disponible en cuentas"
                right={<MoneyText monto={pm.valorLiquido} moneda={pm.moneda} style={styles.montoRow} />}
              />
              {metricas?.liquidez != null && (
                <Row left="Parte que está en cuentas" right={`${Math.round(metricas.liquidez * 100)}%`} />
              )}

              {metricas && metricas.distribucionPorActivo.length > 0 && (
                <>
                  <Text style={styles.subTitle}>En qué está lo que tienen</Text>
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
                  <Text style={styles.subTitle}>Qué deben</Text>
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
