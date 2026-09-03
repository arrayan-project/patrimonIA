import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AlcanceReporte,
  type HogarDTO,
  type ResumenAnualDTO,
  type ResumenFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  Button,
  colorCategoria,
  colors,
  EmptyState,
  ErrorText,
  etiqueta,
  fechaLegible,
  MoneyText,
  Screen,
  Segmented,
  Title,
} from '../ui';
import { Dona, GraficoBarras } from '../ui/charts';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function MovimientosScreen() {
  const { token } = useSession();
  const nav = useNav();

  const hoy = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [modo, setModo] = useState<'Mes' | 'Año'>('Mes');
  const [alcance, setAlcance] = useState<AlcanceReporte>('mios');
  const [hogarId, setHogarId] = useState<string | null>(null);

  const [resumen, setResumen] = useState<ResumenFinancieroDTO | null>(null);
  const [balancePrev, setBalancePrev] = useState<number | null>(null);
  const [anual, setAnual] = useState<ResumenAnualDTO | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    setCargando(true);
    try {
      let hid = hogarId;
      if (alcance === 'hogar' && !hid) {
        const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        hid = hs[0]?.id ?? null;
        setHogarId(hid);
      }
      const q = alcance === 'hogar' && hid ? `&alcance=hogar&hogarId=${hid}` : '&alcance=mios';

      if (modo === 'Mes') {
        const { anio, mes } = anchor;
        const desde = iso(anio, mes, 1);
        const hasta = iso(anio, mes + 1, 0); // día 0 del mes siguiente = último del actual
        const prevMes = mes === 0 ? 11 : mes - 1;
        const prevAnio = mes === 0 ? anio - 1 : anio;
        const [r, p] = await Promise.all([
          api.get<ResumenFinancieroDTO>(
            `/usuarios/me/resumen-financiero?desde=${desde}&hasta=${hasta}${q}`,
            token,
          ),
          api
            .get<ResumenFinancieroDTO>(
              `/usuarios/me/resumen-financiero?desde=${iso(prevAnio, prevMes, 1)}&hasta=${iso(prevAnio, prevMes + 1, 0)}${q}`,
              token,
            )
            .catch(() => null),
        ]);
        setResumen(r);
        setAnual(null);
        setBalancePrev(p ? p.porMoneda.reduce((s, m) => s + m.balance, 0) : null);
      } else {
        setAnual(
          await api.get<ResumenAnualDTO>(
            `/usuarios/me/resumen-anual?anio=${anchor.anio}${q}`,
            token,
          ),
        );
        setResumen(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  }, [token, anchor, modo, alcance, hogarId]);

  useCargaAlEnfocar(cargar);

  const mover = (delta: number) => {
    setAnchor((a) => {
      if (modo === 'Año') return { ...a, anio: a.anio + delta };
      let mes = a.mes + delta;
      let anio = a.anio;
      if (mes < 0) {
        mes = 11;
        anio--;
      } else if (mes > 11) {
        mes = 0;
        anio++;
      }
      return { anio, mes };
    });
  };

  const titulo = modo === 'Año' ? `${anchor.anio}` : `${MESES[anchor.mes]} ${anchor.anio}`;

  const totales = resumen
    ? resumen.porMoneda.reduce(
        (s, m) => ({ ingresos: s.ingresos + m.ingresos, gastos: s.gastos + m.gastos }),
        { ingresos: 0, gastos: 0 },
      )
    : null;
  const balance = totales ? totales.ingresos - totales.gastos : 0;
  const monedaPrincipal = resumen?.porMoneda[0]?.moneda ?? 'CLP';
  const multiMoneda = (resumen?.porMoneda.length ?? 0) > 1;

  const gastosRubro = (resumen?.porRubro ?? []).filter((r) => r.tipo === 'GASTO' && r.total > 0);

  return (
    <Screen onRefresh={cargar}>
      <Title>Movimientos</Title>

      <View style={styles.selectorFila}>
        <Pressable hitSlop={10} onPress={() => mover(-1)}>
          <Text style={styles.flecha}>‹</Text>
        </Pressable>
        <Text style={styles.periodo}>{titulo}</Text>
        <Pressable hitSlop={10} onPress={() => mover(1)}>
          <Text style={styles.flecha}>›</Text>
        </Pressable>
      </View>

      <Segmented options={['Mes', 'Año'] as const} value={modo} onChange={setModo} formatearOpcion={(v) => v} />
      <Segmented
        options={['mios', 'hogar'] as const}
        value={alcance}
        onChange={setAlcance}
        formatearOpcion={(v) => (v === 'mios' ? 'Míos' : 'Del hogar')}
      />

      {cargando && !resumen && !anual && <ActivityIndicator color={colors.primary} />}

      {modo === 'Mes' && resumen && (
        <>
          <View style={styles.card}>
            <Row label="Ingresos" valor={totales!.ingresos} moneda={monedaPrincipal} />
            <Row label="Gastos" valor={totales!.gastos} moneda={monedaPrincipal} />
            <View style={styles.sep} />
            <View style={styles.balFila}>
              <Text style={styles.balLabel}>Balance</Text>
              <MoneyText monto={balance} moneda={monedaPrincipal} style={styles.balMonto} />
            </View>
            {balancePrev != null && (
              <Text style={styles.muted}>
                {balance - balancePrev >= 0 ? '▲' : '▼'} {money(Math.abs(balance - balancePrev), monedaPrincipal)} vs.
                el período anterior
              </Text>
            )}
            {multiMoneda && (
              <Text style={styles.muted}>Hay movimientos en varias monedas — se muestran sumados sin conversión.</Text>
            )}
          </View>

          {gastosRubro.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Gastos por rubro</Text>
              <Dona
                segmentos={gastosRubro.map((r, i) => ({
                  label: r.nombre,
                  valor: r.total,
                  color: colorCategoria(r.color, i),
                }))}
                centro={money(totales!.gastos, monedaPrincipal).replace(` ${monedaPrincipal}`, '')}
                formatoValor={(n) => money(n, monedaPrincipal)}
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {resumen.movimientos.length} movimiento{resumen.movimientos.length === 1 ? '' : 's'}
            </Text>
            {resumen.movimientos.length === 0 ? (
              <Text style={styles.muted}>Sin ingresos ni gastos este período.</Text>
            ) : (
              resumen.movimientos.map((m) => (
                <Pressable
                  key={m.eventoId}
                  style={styles.mov}
                  onPress={() => nav.go('MovimientoDetalle', { eventoId: m.eventoId })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.movTitulo}>{m.glosa || etiqueta(m.tipo)}</Text>
                    <Text style={styles.muted}>
                      {fechaLegible(m.fecha)}
                      {m.corregido ? ' · corregido' : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.movMonto,
                      { color: m.tipo === 'GASTO' ? colors.danger : colors.primary },
                    ]}
                  >
                    {m.tipo === 'GASTO' ? '−' : '+'}
                    {money(m.monto, m.moneda)}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                </Pressable>
              ))
            )}
          </View>
        </>
      )}

      {modo === 'Año' && anual && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ingresos vs. gastos por mes</Text>
          {anual.meses.every((m) => m.porMoneda.length === 0) ? (
            <Text style={styles.muted}>Sin movimientos en {anual.anio}.</Text>
          ) : (
            <>
              <GraficoBarras
                barras={anual.meses.map((m) => ({
                  etiqueta: MESES[m.mes - 1],
                  ingresos: m.porMoneda.reduce((s, x) => s + x.ingresos, 0),
                  gastos: m.porMoneda.reduce((s, x) => s + x.gastos, 0),
                }))}
              />
              <View style={styles.sep} />
              <Row
                label="Ingresos del año"
                valor={anual.meses.reduce((s, m) => s + m.porMoneda.reduce((t, x) => t + x.ingresos, 0), 0)}
                moneda="CLP"
              />
              <Row
                label="Gastos del año"
                valor={anual.meses.reduce((s, m) => s + m.porMoneda.reduce((t, x) => t + x.gastos, 0), 0)}
                moneda="CLP"
              />
            </>
          )}
        </View>
      )}

      {modo === 'Mes' && resumen && resumen.movimientos.length === 0 && (
        <EmptyState
          icon="add-circle-outline"
          titulo="Nada registrado este mes"
          descripcion="Registra un ingreso o gasto para verlo acá."
        />
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar movimiento" onPress={() => nav.go('RegistrarMovimiento')} />
    </Screen>
  );
}

function Row({ label, valor, moneda }: { label: string; valor: number; moneda: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValor}>{money(valor, moneda)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 8 },
  selectorFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  flecha: { fontSize: 30, color: colors.primary, paddingHorizontal: 8 },
  periodo: { fontSize: 18, fontWeight: '700', color: colors.text, minWidth: 130, textAlign: 'center', textTransform: 'capitalize' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  sep: { height: 1, backgroundColor: colors.faint, marginVertical: 4 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dataLabel: { fontSize: 14, color: colors.muted },
  dataValor: { fontSize: 14, color: colors.text, fontWeight: '600' },
  balFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  balMonto: { fontSize: 20, fontWeight: '800' },
  mov: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.faint,
    paddingTop: 8,
  },
  movTitulo: { fontSize: 14, fontWeight: '600', color: colors.text },
  movMonto: { fontSize: 15, fontWeight: '700' },
});
