import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type HogarDTO,
  type MovimientoReporteDTO,
  type PatrimonioIndividualDTO,
  type ResumenAnualDTO,
  type ResumenFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useAlcance } from '../ui/alcance';
import {
  Chip,
  colorCategoria,
  EmptyState,
  ErrorText,
  etiqueta,
  FAB,
  Field,
  fechaLegible,
  GroupLabel,
  Hero,
  IconButton,
  MenuList,
  PillToggle,
  Skeleton,
  Screen,
  Segmented,
  Title,
  TopRow,
  Panel,
  TxRow,
  useC,
  tipoDe,
  type Paleta,
} from '../ui';
import { Dona, GraficoBarras } from '../ui/charts';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

type Periodo = 'Mes' | 'Año' | 'Recientes';
const FILTROS = ['Todos', 'Ingresos', 'Gastos', 'Transferencias'] as const;
type Filtro = (typeof FILTROS)[number];

const logoTipo = (tipo: string) =>
  tipo === 'INGRESO'
    ? ('arrow-down-outline' as const)
    : tipo === 'GASTO'
      ? ('arrow-up-outline' as const)
      : tipo === 'SALDO_INICIAL'
        ? ('flag-outline' as const)
        : ('swap-horizontal-outline' as const);

export function MovimientosScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const { alcance, setAlcance } = useAlcance();

  const hoy = useMemo(() => new Date(), []);
  const [periodo, setPeriodo] = useState<Periodo>('Mes');
  const [anchor, setAnchor] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [mesesAtras, setMesesAtras] = useState(3);

  const [hogarId, setHogarId] = useState<string | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [resumen, setResumen] = useState<ResumenFinancieroDTO | null>(null);
  const [balancePrev, setBalancePrev] = useState<number | null>(null);
  const [anual, setAnual] = useState<ResumenAnualDTO | null>(null);
  const [disponible, setDisponible] = useState<PatrimonioIndividualDTO | null>(null);

  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('Todos');

  // Ventana [desde, hasta] según el período elegido.
  const ventana = useMemo(() => {
    if (periodo === 'Año') {
      return { desde: iso(anchor.anio, 0, 1), hasta: iso(anchor.anio, 11, 31) };
    }
    if (periodo === 'Recientes') {
      return {
        desde: iso(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 1),
        hasta: iso(hoy.getFullYear(), hoy.getMonth() + 1, 0),
      };
    }
    return { desde: iso(anchor.anio, anchor.mes, 1), hasta: iso(anchor.anio, anchor.mes + 1, 0) };
  }, [periodo, anchor, mesesAtras, hoy]);

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

      api
        .get<{ noLeidas: number }>('/usuarios/me/notificaciones/no-leidas', token)
        .then(({ noLeidas: n }) => setNoLeidas(n))
        .catch(() => undefined);

      if (alcance === 'mios') {
        api
          .get<PatrimonioIndividualDTO>('/usuarios/me/patrimonio-individual', token)
          .then(setDisponible)
          .catch(() => setDisponible(null));
      } else {
        setDisponible(null);
      }

      const { desde, hasta } = ventana;
      const pedirResumen = (d: string, h: string) =>
        api.get<ResumenFinancieroDTO>(
          `/usuarios/me/resumen-financiero?desde=${d}&hasta=${h}${q}`,
          token,
        );

      if (periodo === 'Mes') {
        const prevMes = anchor.mes === 0 ? 11 : anchor.mes - 1;
        const prevAnio = anchor.mes === 0 ? anchor.anio - 1 : anchor.anio;
        const [r, p] = await Promise.all([
          pedirResumen(desde, hasta),
          pedirResumen(iso(prevAnio, prevMes, 1), iso(prevAnio, prevMes + 1, 0)).catch(() => null),
        ]);
        setResumen(r);
        setAnual(null);
        setBalancePrev(p ? p.porMoneda.reduce((s, m) => s + m.balance, 0) : null);
      } else if (periodo === 'Año') {
        const [r, a] = await Promise.all([
          pedirResumen(desde, hasta),
          api.get<ResumenAnualDTO>(`/usuarios/me/resumen-anual?anio=${anchor.anio}${q}`, token),
        ]);
        setResumen(r);
        setAnual(a);
        setBalancePrev(null);
      } else {
        setResumen(await pedirResumen(desde, hasta));
        setAnual(null);
        setBalancePrev(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  }, [token, periodo, anchor, ventana, alcance, hogarId]);

  useCargaAlEnfocar(cargar);

  const mover = (delta: number) => {
    setAnchor((a) => {
      if (periodo === 'Año') return { ...a, anio: a.anio + delta };
      let mes = a.mes + delta;
      let anio = a.anio;
      if (mes < 0) { mes = 11; anio--; }
      else if (mes > 11) { mes = 0; anio++; }
      return { anio, mes };
    });
  };

  const movimientos = useMemo(
    () => [...(resumen?.movimientos ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [resumen],
  );
  const movsFiltrados = movimientos.filter((m) => {
    if (filtro === 'Ingresos' && m.tipo !== 'INGRESO' && m.tipo !== 'SALDO_INICIAL') return false;
    if (filtro === 'Gastos' && m.tipo !== 'GASTO') return false;
    if (filtro === 'Transferencias' && m.tipo !== 'TRANSFERENCIA' && m.tipo !== 'CONVERSION')
      return false;
    const t = busca.trim().toLowerCase();
    if (t && !(m.glosa ?? '').toLowerCase().includes(t) && !etiqueta(m.tipo).toLowerCase().includes(t))
      return false;
    return true;
  });

  const titulo =
    periodo === 'Año'
      ? `${anchor.anio}`
      : periodo === 'Recientes'
        ? `Últimos ${mesesAtras} meses`
        : `${MESES_LARGO[anchor.mes]} ${anchor.anio}`;
  const etiquetaPeriodo =
    periodo === 'Año' ? `${anchor.anio}` : periodo === 'Recientes' ? 'los últimos meses' : MESES_LARGO[anchor.mes];

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
  const dispLiquido = disponible?.porMoneda.find((m) => m.moneda === monedaPrincipal) ?? disponible?.porMoneda[0];

  return (
    <Screen onRefresh={cargar} fab={<FAB icon="add" onPress={() => nav.go('RegistrarMovimiento')} />}>
      <TopRow
        left={<Title>Movimientos</Title>}
        right={
          <IconButton
            icon="notifications-outline"
            badge={noLeidas || undefined}
            accessibilityLabel="Notificaciones"
            onPress={() => nav.go('Notificaciones')}
          />
        }
      />
      <View style={styles.controles}>
        <PillToggle
          options={['mios', 'hogar'] as const}
          value={alcance}
          onChange={setAlcance}
          format={(x) => (x === 'mios' ? 'Míos' : 'Del hogar')}
        />
      </View>

      <View style={styles.selectorFila}>
        <Pressable
          hitSlop={10}
          disabled={periodo === 'Recientes'}
          onPress={() => mover(-1)}
          style={periodo === 'Recientes' && styles.flechaOff}
        >
          <Text style={styles.flecha}>‹</Text>
        </Pressable>
        <Text style={styles.periodo}>{titulo}</Text>
        <Pressable
          hitSlop={10}
          disabled={periodo === 'Recientes'}
          onPress={() => mover(1)}
          style={periodo === 'Recientes' && styles.flechaOff}
        >
          <Text style={styles.flecha}>›</Text>
        </Pressable>
      </View>
      <Segmented
        options={['Mes', 'Año', 'Recientes'] as const}
        value={periodo}
        onChange={setPeriodo}
        formatearOpcion={(v) => v}
      />

      {cargando && !resumen ? (
        <Skeleton filas={2} />
      ) : (
        <>
          <Hero
            label={`Balance de ${etiquetaPeriodo}`}
            value={money(balance, monedaPrincipal)}
            change={
              balancePrev != null
                ? `${balance - balancePrev >= 0 ? '▲' : '▼'} ${money(Math.abs(balance - balancePrev), monedaPrincipal)}`
                : undefined
            }
            changeDir={balancePrev != null && balance - balancePrev < 0 ? 'neg' : 'pos'}
            substats={[
              { label: 'Ingresos', value: money(totales?.ingresos ?? 0, monedaPrincipal) },
              { label: 'Gastos', value: money(totales?.gastos ?? 0, monedaPrincipal) },
            ]}
          />
          {alcance === 'mios' && dispLiquido && (
            <Text style={styles.disp}>
              Disponible hoy · <Text style={styles.dispB}>{money(dispLiquido.valorLibre, dispLiquido.moneda)}</Text>
              {dispLiquido.valorReservado > 0
                ? `  (${money(dispLiquido.valorLiquido, dispLiquido.moneda)} líquido − ${money(dispLiquido.valorReservado, dispLiquido.moneda)} apartado)`
                : ''}
            </Text>
          )}
          {multiMoneda && (
            <Text style={styles.muted}>Hay movimientos en varias monedas — se muestran sumados sin conversión.</Text>
          )}

          {periodo === 'Año' && anual && !anual.meses.every((m) => m.porMoneda.length === 0) && (
            <Panel>
              <Text style={styles.sectionTitle}>Ingresos vs. gastos por mes</Text>
              <GraficoBarras
                barras={anual.meses.map((m) => ({
                  etiqueta: MESES[m.mes - 1],
                  ingresos: m.porMoneda.reduce((s, x) => s + x.ingresos, 0),
                  gastos: m.porMoneda.reduce((s, x) => s + x.gastos, 0),
                }))}
              />
            </Panel>
          )}

          {gastosRubro.length > 0 && (
            <Panel>
              <Text style={styles.sectionTitle}>Gastos por rubro</Text>
              <Dona
                segmentos={gastosRubro.map((r, i) => ({ label: r.nombre, valor: r.total, color: colorCategoria(r.color, i) }))}
                centro={money(totales?.gastos ?? 0, monedaPrincipal).replace(` ${monedaPrincipal}`, '')}
                formatoValor={(n) => money(n, monedaPrincipal)}
              />
            </Panel>
          )}

          <Field label="" value={busca} onChangeText={setBusca} placeholder="Buscar en el detalle…" />
          <View style={styles.chips}>
            {FILTROS.map((f) => (
              <Chip key={f} label={f} activo={filtro === f} onPress={() => setFiltro(f)} />
            ))}
          </View>

          {movsFiltrados.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              titulo={movimientos.length === 0 ? `Sin movimientos en ${etiquetaPeriodo}` : 'Nada coincide con el filtro'}
              descripcion={movimientos.length === 0 ? 'Registra un ingreso o gasto para verlo acá.' : undefined}
            />
          ) : (
            <Panel gap={0}>
              {movsFiltrados.map((m) => (
                <FilaMovimiento key={m.eventoId} m={m} onPress={() => nav.go('MovimientoDetalle', { eventoId: m.eventoId })} />
              ))}
            </Panel>
          )}

          {periodo === 'Recientes' && (
            <Pressable style={styles.mas} onPress={() => setMesesAtras((n) => n + 3)}>
              <Text style={styles.link}>Cargar 3 meses más (desde hace {mesesAtras + 3})</Text>
            </Pressable>
          )}
        </>
      )}

      <GroupLabel>Más</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Movimientos programados',
            subtitle: 'Ingresos y gastos futuros con fecha',
            icon: 'calendar-outline',
            onPress: () => nav.go('MovimientosProgramados'),
          },
          {
            title: 'Plantillas de movimiento',
            subtitle: 'Moldes para el gasto o ingreso de siempre',
            icon: 'copy-outline',
            onPress: () => nav.go('Plantillas'),
          },
        ]}
      />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function FilaMovimiento({ m, onPress }: { m: MovimientoReporteDTO; onPress: () => void }) {
  const interno = m.tipo === 'TRANSFERENCIA' || m.tipo === 'CONVERSION';
  const dir =
    m.efectoPropio == null || m.efectoPropio === 0
      ? 'Movimiento interno'
      : m.efectoPropio < 0
        ? 'Salió de tus cuentas'
        : 'Entró a tus cuentas';
  const signo = m.tipo === 'GASTO' ? '−' : m.tipo === 'INGRESO' || m.tipo === 'SALDO_INICIAL' ? '+' : '';
  return (
    <TxRow
      title={m.glosa || etiqueta(m.tipo)}
      subtitle={`${interno ? dir : etiqueta(m.tipo)} · ${fechaLegible(m.fecha)}${m.corregido ? ' · corregido' : ''}`}
      amount={`${signo}${money(m.monto, m.moneda)}`}
      positivo={m.tipo === 'INGRESO' || m.tipo === 'SALDO_INICIAL'}
      logo={{ icon: logoTipo(m.tipo) }}
      onPress={onPress}
    />
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    selectorFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
    flecha: { fontSize: 30, color: c.primary, paddingHorizontal: 8 },
    flechaOff: { opacity: 0.25 },
    periodo: { fontSize: 18, fontWeight: '700', color: c.text, minWidth: 170, textAlign: 'center', textTransform: 'capitalize' },
    sectionTitle: tipoDe(c).seccion,
    muted: tipoDe(c).nota,
    disp: { fontSize: 13, color: c.muted, marginTop: -4 },
    dispB: { color: c.text, fontWeight: '700' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    controles: { flexDirection: 'row' },
    mas: { alignItems: 'center', paddingVertical: 6 },
    link: { fontSize: 13, color: c.text, fontWeight: '600', textDecorationLine: 'underline' },
  });
