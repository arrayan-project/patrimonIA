import { useMemo, useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type MetricasHogarDTO,
  type ObjetivoFinancieroDTO,
  type PatrimonioConsolidadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { EMOJI_CATEGORIA_FUNCIONAL, NOMBRE_CATEGORIA_FUNCIONAL, emojiElemento } from '../emojis';
import { usePreferencias } from '../preferencias';
import { cargarCuentasHogar, deQuien } from '../cuentasHogar';
import { TarjetaMeta } from './ObjetivosScreen';
import {
  Dato,
  Datos,
  ErrorText,
  Hero,
  ListCard,
  Nota,
  Panel,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
  type Paleta,
} from '../ui';

type PorMoneda = MetricasHogarDTO['porMoneda'][number];

// En el orden del Inicio: Cuentas, Ahorro, Inversiones, Bienes, Te deben, Deudas.
const ORDEN = Object.keys(EMOJI_CATEGORIA_FUNCIONAL);
const enOrden = <T extends { categoria: string }>(xs: T[]) =>
  [...xs].sort((a, b) => ORDEN.indexOf(a.categoria) - ORDEN.indexOf(b.categoria));

/**
 * Patrimonio del hogar (G35): la plata del hogar como una resta que cuadra
 * —cada grupo del Inicio, Tienen, lo que deben y el total—, las cuentas y
 * bienes que suman (cada una abre su detalle) y las metas del hogar.
 */
export function HogarConsolidadoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const hogarId = nav.route.params?.hogarId as string;

  const [cons, setCons] = useState<PatrimonioConsolidadoDTO | null>(null);
  const [met, setMet] = useState<MetricasHogarDTO | null>(null);
  const [suman, setSuman] = useState<ElementoPatrimonialDTO[]>([]);
  const [metas, setMetas] = useState<ObjetivoFinancieroDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [c, m, cuentas, objs] = await Promise.all([
        api.get<PatrimonioConsolidadoDTO>(`/hogares/${hogarId}/patrimonio-consolidado`, token),
        api.get<MetricasHogarDTO>(`/hogares/${hogarId}/metricas`, token),
        cargarCuentasHogar(token),
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
      ]);
      setCons(c);
      setMet(m);
      setSuman(cuentas.suman);
      setMetas(objs.filter((o) => o.hogarId === hogarId && o.estado !== 'CANCELADO'));
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

  const unaMoneda = met.porMoneda.length === 1;

  // Cada grupo de lo que tienen, Tienen, cada grupo de lo que deben y el total de esa moneda.
  const resta = (pm: PorMoneda) => (
    <Datos plano={unaMoneda}>
      {enOrden(pm.distribucionPorActivo).map((d) => (
        <Dato
          key={d.categoria}
          etiqueta={`${EMOJI_CATEGORIA_FUNCIONAL[d.categoria] ?? '💼'} ${NOMBRE_CATEGORIA_FUNCIONAL[d.categoria] ?? d.categoria}`}
          valor={money(d.valor, pm.moneda)}
        />
      ))}
      {pm.distribucionPorPasivo.length > 0 && (
        <Dato etiqueta="💰 Tienen" valor={<Text style={styles.total}>{money(pm.activos, pm.moneda)}</Text>} />
      )}
      {enOrden(pm.distribucionPorPasivo).map((d) => (
        <Dato
          key={d.categoria}
          etiqueta={`${EMOJI_CATEGORIA_FUNCIONAL[d.categoria] ?? '💳'} ${NOMBRE_CATEGORIA_FUNCIONAL[d.categoria] ?? d.categoria}`}
          valor={<Text style={styles.resta}>{`− ${money(d.valor, pm.moneda)}`}</Text>}
        />
      ))}
      <Dato
        etiqueta={unaMoneda ? '🏠 Plata del hogar' : `🏠 En ${pm.moneda}`}
        valor={<Text style={styles.total}>{money(pm.patrimonioNeto, pm.moneda)}</Text>}
      />
    </Datos>
  );

  return (
    <Screen onRefresh={cargar}>
      <Hero
        label="🏠 Plata del hogar"
        value={cons.total != null ? money(cons.total, cons.monedaConsolidacion) : '—'}
        debajo={unaMoneda ? resta(met.porMoneda[0]) : undefined}
      />
      {cons.total == null && (
        <ErrorText>{`Falta el valor de ${cons.conversionesFaltantes.join(', ')} en ${cons.monedaConsolidacion} para sumar todo.`}</ErrorText>
      )}
      {!unaMoneda &&
        met.porMoneda.map((pm) => (
          <Section key={pm.moneda} title={`💱 En ${pm.moneda}`}>
            {resta(pm)}
          </Section>
        ))}

      <Section title="🏦 Las cuentas y bienes del hogar">
        {suman.length === 0 ? (
          <Nota>Ninguna cuenta ni bien suma al hogar por ahora.</Nota>
        ) : (
          <ListCard>
            {suman.map((e) => (
              <TxRow
                key={e.id}
                title={e.nombre}
                subtitle={deQuien(e, usuario.id)}
                amount={e.valorOculto ? '—' : money(e.valorVigente, e.moneda)}
                negativo={!e.valorOculto && e.valorVigente < 0}
                logo={{ emoji: emojiElemento(e, preferencias.emojis.elementos) }}
                onPress={() => nav.go('ElementoDetalle', { elementoId: e.id })}
              />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="🎯 Metas del hogar">
        {metas.length === 0 ? (
          <Panel>
            <Text style={styles.muted}>Ninguna meta compartida con el hogar.</Text>
          </Panel>
        ) : (
          metas.map((o) => <TarjetaMeta key={o.id} o={o} ahorrar />)
        )}
      </Section>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  total: { fontSize: 15, fontWeight: '800', color: c.text, textAlign: 'right' },
  resta: { fontSize: 14, color: c.muted, textAlign: 'right' },
  muted: { fontSize: 14, color: c.muted },
});
