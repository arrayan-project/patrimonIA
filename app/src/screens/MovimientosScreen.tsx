import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { TITULO_ANOTAR, useAnotar } from '../hooks/useAnotar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type HogarDTO,
  type MovimientoReporteDTO,
  type ResumenAnualDTO,
  type ResumenFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useAlcance } from '../ui/alcance';
import { emojiCategoria, emojiTipoMovimiento } from '../emojis';
import {
  Button,
  colorCategoria,
  EmptyState,
  ErrorText,
  etiqueta,
  FabMenu,
  Field,
  IconButton,
  ListCard,
  Panel,
  Pastilla,
  PillToggle,
  Row,
  Section,
  Skeleton,
  Screen,
  Segmented,
  Title,
  TopRow,
  TxRow,
  useC,
  tipoDe,
  type Paleta,
} from '../ui';
import { GraficoBarras } from '../ui/charts';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Fecha ISO de (año, mes 0-11, día); normaliza meses y días fuera de rango (mes -1 = diciembre anterior, día 0 = último del mes previo). */
const iso = (y: number, m: number, d: number) => {
  const f = new Date(y, m, d);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

type Periodo = 'Mes' | 'Año' | 'Recientes';
// G35: los filtros hablan como las puertas del "+".
const FILTROS = ['Todo', 'Gasté', 'Recibí', 'Moví'] as const;
type Filtro = (typeof FILTROS)[number];
const EMOJI_FILTRO: Record<Filtro, string> = { Todo: '', Gasté: '💸 ', Recibí: '💰 ', Moví: '🔁 ' };

/** Categoría por la que se filtra la lista; `id` null = "Sin categoría". */
type FiltroCategoria = { id: string | null; nombre: string };

/** Cuántas categorías se ven en "¿En qué se fue?" antes de "Ver todas". */
const RUBROS_A_LA_VISTA = 4;

/** Encabezado de un día de la lista: "Hoy", "Ayer", "Miércoles 7 de octubre". */
export function nombreDia(fecha: string, hoy: Date): string {
  const [a, m, d] = fecha.slice(0, 10).split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diff = Math.round((base.getTime() - dia.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const txt = `${DIAS[dia.getDay()]} ${d} de ${MESES_LARGO[m - 1]}${a !== hoy.getFullYear() ? ` de ${a}` : ''}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/**
 * Pestaña Movimientos. Con `soloHogar` es "Movimientos del hogar" abierto desde
 * el Hogar (encima, con atrás): la misma lista en "Del hogar", sin el selector.
 */
export function MovimientosScreen({ soloHogar = false }: { soloHogar?: boolean } = {}) {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const anotar = useAnotar();
  const ctxAlcance = useAlcance();
  const alcance = soloHogar ? 'hogar' : ctxAlcance.alcance;

  const hoy = useMemo(() => new Date(), []);
  const [periodo, setPeriodo] = useState<Periodo>('Mes');
  const [anchor, setAnchor] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [mesesAtras, setMesesAtras] = useState(3);

  // En un ref: guardarlo no debe cambiar `cargar` (si no, la pantalla carga dos veces al abrirse).
  const hogarIdRef = useRef<string | null>((nav.route.params?.hogarId as string | undefined) ?? null);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [resumen, setResumen] = useState<ResumenFinancieroDTO | null>(null);
  const [balancePrev, setBalancePrev] = useState<number | null>(null);
  const [anual, setAnual] = useState<ResumenAnualDTO | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('Todo');
  const [verTodosRubros, setVerTodosRubros] = useState(false);

  // G32 H-05 — se llega filtrado por categoría desde un movimiento o un rubro del
  // presupuesto (`mes` = cualquier fecha del mes a mostrar). G35: también se
  // filtra tocando una categoría de "¿En qué se fue?".
  const categoriaParam = nav.route.params?.categoriaId as string | undefined;
  const categoriaNombreParam = nav.route.params?.categoriaNombre as string | undefined;
  const mesParam = nav.route.params?.mes as string | undefined;
  const [catFiltro, setCatFiltro] = useState<FiltroCategoria | null>(null);
  useEffect(() => {
    setCatFiltro(categoriaParam ? { id: categoriaParam, nombre: categoriaNombreParam ?? 'Categoría' } : null);
  }, [categoriaParam, categoriaNombreParam]);
  useEffect(() => {
    if (!mesParam) return;
    const [a, m] = mesParam.split('-').map(Number);
    setPeriodo('Mes');
    setAnchor({ anio: a, mes: m - 1 });
  }, [mesParam]);

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
      let hid = hogarIdRef.current;
      if (!hid) {
        const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        hid = hs[0]?.id ?? null;
        hogarIdRef.current = hid;
      }
      const q = alcance === 'hogar' && hid ? `&alcance=hogar&hogarId=${hid}` : '&alcance=mios';

      api
        .get<{ noLeidas: number }>('/usuarios/me/notificaciones/no-leidas', token)
        .then(({ noLeidas: n }) => setNoLeidas(n))
        .catch(() => undefined);
      // G35: las categorías, para el emoji de cada movimiento y de cada rubro.
      if (hid) {
        api
          .get<CategoriaMovimientoDTO[]>(`/hogares/${hid}/categorias-movimiento?incluirArchivadas=true`, token)
          .then(setCategorias)
          .catch(() => undefined);
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
  }, [token, periodo, anchor, ventana, alcance]);

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

  const catPorId = useMemo(() => new Map(categorias.map((x) => [x.id, x])), [categorias]);
  const movimientos = useMemo(
    () => [...(resumen?.movimientos ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [resumen],
  );
  const movsFiltrados = movimientos.filter((m) => {
    if (catFiltro) {
      if (catFiltro.id === null ? m.categoriaId !== null || m.tipo !== 'GASTO' : m.categoriaId !== catFiltro.id) return false;
    }
    if (filtro === 'Recibí' && m.tipo !== 'INGRESO' && m.tipo !== 'SALDO_INICIAL') return false;
    if (filtro === 'Gasté' && m.tipo !== 'GASTO') return false;
    if (filtro === 'Moví' && m.tipo !== 'TRANSFERENCIA' && m.tipo !== 'CONVERSION') return false;
    const t = busca.trim().toLowerCase();
    if (
      t &&
      !(m.glosa ?? '').toLowerCase().includes(t) &&
      !(m.categoriaId ? (catPorId.get(m.categoriaId)?.nombre ?? '') : '').toLowerCase().includes(t) &&
      !etiqueta(m.tipo).toLowerCase().includes(t)
    )
      return false;
    return true;
  });
  // G35: la lista va agrupada por día.
  const porDia = useMemo(() => {
    const grupos: { dia: string; movs: MovimientoReporteDTO[] }[] = [];
    for (const m of movsFiltrados) {
      const dia = m.fecha.slice(0, 10);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.movs.push(m);
      else grupos.push({ dia, movs: [m] });
    }
    return grupos;
  }, [movsFiltrados]);

  const titulo =
    periodo === 'Año'
      ? `${anchor.anio}`
      : periodo === 'Recientes'
        ? `Últimos ${mesesAtras} meses`
        : `${MESES_LARGO[anchor.mes]} ${anchor.anio}`;
  const etiquetaPeriodo =
    periodo === 'Año' ? `${anchor.anio}` : periodo === 'Recientes' ? 'los últimos meses' : MESES_LARGO[anchor.mes];
  const enCurso =
    periodo === 'Recientes' ||
    (periodo === 'Año' ? anchor.anio === hoy.getFullYear() : anchor.anio === hoy.getFullYear() && anchor.mes === hoy.getMonth());
  const tituloResumen =
    periodo === 'Recientes'
      ? `Así van los últimos ${mesesAtras} meses`
      : `${enCurso ? 'Así va' : 'Así fue'} ${etiquetaPeriodo}`;

  const hogar = alcance === 'hogar';
  const totales = resumen
    ? resumen.porMoneda.reduce(
        (s, m) => ({ ingresos: s.ingresos + m.ingresos, gastos: s.gastos + m.gastos }),
        { ingresos: 0, gastos: 0 },
      )
    : null;
  const balance = totales ? totales.ingresos - totales.gastos : 0;
  const monedaPrincipal = resumen?.porMoneda[0]?.moneda ?? 'CLP';
  const multiMoneda = (resumen?.porMoneda.length ?? 0) > 1;
  const mesAnterior = MESES_LARGO[anchor.mes === 0 ? 11 : anchor.mes - 1];
  const contraAnterior = balancePrev != null ? balance - balancePrev : null;

  const gastosRubro = (resumen?.porRubro ?? [])
    .filter((r) => r.tipo === 'GASTO' && r.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalRubros = gastosRubro.reduce((s, r) => s + r.total, 0);
  const rubrosVisibles = verTodosRubros ? gastosRubro : gastosRubro.slice(0, RUBROS_A_LA_VISTA);
  const emojiDe = (categoriaId: string | null, tipo: string) =>
    emojiCategoria(categoriaId ? catPorId.get(categoriaId) : null) ?? emojiTipoMovimiento(tipo);
  const filtrarCategoria = (f: FiltroCategoria | null) => {
    setCatFiltro(f);
    // Si se había llegado filtrado desde otra pantalla, se limpian esos parámetros.
    if (!f && categoriaParam) nav.go('Movimientos', { categoriaId: undefined, categoriaNombre: undefined, mes: undefined });
  };

  return (
    <Screen onRefresh={cargar} fab={soloHogar ? undefined : <FabMenu titulo={TITULO_ANOTAR} actions={anotar.acciones} />}>
      {!soloHogar && (
        <>
          <TopRow
            left={<Title>Movimientos</Title>}
            right={
              <>
                <IconButton
                  icon="notifications-outline"
                  badge={noLeidas || undefined}
                  accessibilityLabel="Notificaciones"
                  onPress={() => nav.go('Notificaciones')}
                />
                <IconButton icon="settings-outline" accessibilityLabel="Ajustes" onPress={() => nav.go('Ajustes')} />
              </>
            }
          />
          <View style={styles.controles}>
            <PillToggle
              options={['mios', 'hogar'] as const}
              value={alcance}
              onChange={ctxAlcance.setAlcance}
              format={(x) => (x === 'mios' ? 'Lo mío' : 'Del hogar')}
            />
          </View>
        </>
      )}

      <View style={styles.selectorFila}>
        <Pressable
          disabled={periodo === 'Recientes'}
          onPress={() => mover(-1)}
          style={[styles.flechaZona, periodo === 'Recientes' && styles.flechaOff]}
          accessibilityRole="button"
          accessibilityLabel="Período anterior"
        >
          <Text style={styles.flecha}>‹</Text>
        </Pressable>
        <Text style={styles.periodo} numberOfLines={1}>🗓️ {titulo.charAt(0).toUpperCase() + titulo.slice(1)}</Text>
        <Pressable
          disabled={periodo === 'Recientes'}
          onPress={() => mover(1)}
          style={[styles.flechaZona, periodo === 'Recientes' && styles.flechaOff]}
          accessibilityRole="button"
          accessibilityLabel="Período siguiente"
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
          <Section title={tituloResumen}>
            <Panel gap={0}>
              <Row left={hogar ? '📥 Les entró' : '📥 Te entró'} right={money(totales?.ingresos ?? 0, monedaPrincipal)} />
              <Row left={hogar ? '📤 Gastaron' : '📤 Gastaste'} right={money(totales?.gastos ?? 0, monedaPrincipal)} />
              <Row
                left={
                  balance >= 0
                    ? `🎉 ${hogar ? 'Les' : 'Te'} ${enCurso ? 'sobra' : 'sobró'}`
                    : `⚠️ ${hogar ? 'Gastaron' : 'Gastaste'} de más`
                }
                right={
                  <Text style={[styles.balance, { color: balance >= 0 ? c.ok : c.danger }]}>
                    {money(Math.abs(balance), monedaPrincipal)}
                  </Text>
                }
              />
            </Panel>
            {contraAnterior != null && contraAnterior !== 0 && (
              <Text style={styles.muted}>
                {`${contraAnterior > 0 ? '▲' : '▼'} ${money(Math.abs(contraAnterior), monedaPrincipal)} ${
                  contraAnterior > 0 ? 'más' : 'menos'
                } que en ${mesAnterior}`}
              </Text>
            )}
          </Section>
          {multiMoneda && (
            <Text style={styles.muted}>Hay movimientos en varias monedas: se muestran sumados sin convertir.</Text>
          )}

          {periodo === 'Año' && anual && !anual.meses.every((m) => m.porMoneda.length === 0) && (
            <Section title="Mes a mes">
              <Panel>
                <GraficoBarras
                  barras={anual.meses.map((m) => ({
                    etiqueta: MESES[m.mes - 1],
                    ingresos: m.porMoneda.reduce((s, x) => s + x.ingresos, 0),
                    gastos: m.porMoneda.reduce((s, x) => s + x.gastos, 0),
                  }))}
                />
              </Panel>
            </Section>
          )}

          {gastosRubro.length > 0 && (
            <Section
              title="¿En qué se fue?"
              accion={verTodosRubros ? 'Ver menos' : `Ver todas (${gastosRubro.length})`}
              onAccion={gastosRubro.length > RUBROS_A_LA_VISTA ? () => setVerTodosRubros((v) => !v) : undefined}
            >
              <Panel gap={0}>
                {rubrosVisibles.map((r, i) => {
                  const pct = totalRubros > 0 ? r.total / totalRubros : 0;
                  const activo = catFiltro?.id === r.categoriaId;
                  return (
                    <Pressable
                      key={r.categoriaId ?? 'sin'}
                      onPress={() => filtrarCategoria(activo ? null : { id: r.categoriaId, nombre: r.categoriaId ? r.nombre : 'Sin categoría' })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                      accessibilityLabel={`${r.nombre}: ${money(r.total, monedaPrincipal)}. Ver sus movimientos`}
                      style={({ pressed }) => [styles.rubro, activo && styles.rubroActivo, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.rubroEmoji}>{emojiDe(r.categoriaId, 'GASTO')}</Text>
                      <View style={styles.rubroCuerpo}>
                        <View style={styles.rubroFila}>
                          <Text style={styles.rubroNombre} numberOfLines={1}>{r.categoriaId ? r.nombre : 'Sin categoría'}</Text>
                          <Text style={styles.rubroMonto}>{money(r.total, monedaPrincipal)}</Text>
                        </View>
                        <View style={styles.rubroBarraFila}>
                          <View style={styles.rubroPista}>
                            <View
                              style={[
                                styles.rubroBarra,
                                { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: colorCategoria(r.color, i) },
                              ]}
                            />
                          </View>
                          <Text style={styles.rubroPct}>{pct > 0 && pct < 0.01 ? '<1%' : `${Math.round(pct * 100)}%`}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </Panel>
            </Section>
          )}

          <Section
            title={hogar ? 'Movimientos del hogar' : 'Tus movimientos'}
            accion={buscando ? '✕ Cerrar' : '🔍 Buscar'}
            onAccion={() => {
              if (buscando) setBusca('');
              setBuscando((b) => !b);
            }}
          >
            {buscando && (
              <Field label="" value={busca} onChangeText={setBusca} placeholder="Busca por detalle o categoría" autoFocus />
            )}
            <Segmented
              options={FILTROS}
              value={filtro}
              onChange={setFiltro}
              formatearOpcion={(f) => `${EMOJI_FILTRO[f]}${f}`}
            />
            {catFiltro && (
              <View style={styles.filtroFila}>
                <Pastilla
                  label={`${emojiDe(catFiltro.id, 'GASTO')} ${catFiltro.nombre}  ✕`}
                  accessibilityLabel={`Quitar el filtro ${catFiltro.nombre}`}
                  onPress={() => filtrarCategoria(null)}
                />
              </View>
            )}
          </Section>

          {movsFiltrados.length === 0 ? (
            <EmptyState
              emoji={movimientos.length === 0 ? '🧾' : '🔍'}
              titulo={movimientos.length === 0 ? `Aún no anotas nada en ${etiquetaPeriodo}` : 'Nada coincide con lo que buscas'}
              descripcion={movimientos.length === 0 ? 'Anota un gasto o lo que recibiste y aparecerá acá.' : undefined}
              accion={movimientos.length === 0 ? 'Anotar' : undefined}
              onAccion={anotar.abrir}
            />
          ) : (
            porDia.map((g) => (
              <View key={g.dia} style={styles.dia}>
                <Text style={styles.diaTitulo}>{nombreDia(g.dia, hoy)}</Text>
                <ListCard>
                  {g.movs.map((m) => (
                    <FilaMovimiento
                      key={m.eventoId}
                      m={m}
                      categoria={m.categoriaId ? catPorId.get(m.categoriaId) : undefined}
                      emoji={emojiDe(m.categoriaId, m.tipo)}
                      hogar={hogar}
                      onPress={() => nav.go('MovimientoDetalle', { eventoId: m.eventoId })}
                    />
                  ))}
                </ListCard>
              </View>
            ))
          )}

          {periodo === 'Recientes' && (
            <Button title={`⏬ Ver 3 meses más (desde hace ${mesesAtras + 3})`} variant="secondary" onPress={() => setMesesAtras((n) => n + 3)} />
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
      {anotar.hoja}
    </Screen>
  );
}

function FilaMovimiento({
  m,
  categoria,
  emoji,
  hogar,
  onPress,
}: {
  m: MovimientoReporteDTO;
  /** En "Del hogar", `efectoPropio` es sobre las cuentas del hogar, no solo las tuyas. */
  hogar: boolean;
  categoria: CategoriaMovimientoDTO | undefined;
  emoji: string;
  onPress: () => void;
}) {
  const interno = m.tipo === 'TRANSFERENCIA' || m.tipo === 'CONVERSION';
  const titulo = m.glosa || categoria?.nombre || etiqueta(m.tipo);
  let sub: string;
  let signo = '';
  if (interno) {
    const e = m.efectoPropio ?? 0;
    sub = hogar
      ? e === 0 ? 'Entre cuentas del hogar' : e < 0 ? 'Salió del hogar' : 'Entró al hogar'
      : e === 0 ? 'Entre tus cuentas' : e < 0 ? 'Salió de tus cuentas' : 'Entró a tus cuentas';
    signo = e === 0 ? '' : e < 0 ? '−' : '+';
  } else if (m.tipo === 'SALDO_INICIAL') {
    sub = 'Con lo que empezó la cuenta';
    signo = '+';
  } else {
    sub = categoria ? (titulo === categoria.nombre ? etiqueta(m.tipo) : categoria.nombre) : 'Sin categoría';
    signo = m.tipo === 'GASTO' ? '−' : '+';
  }
  return (
    <TxRow
      title={titulo}
      subtitle={`${sub}${m.corregido ? ' · cambiado' : ''}`}
      amount={`${signo}${money(m.monto, m.moneda)}`}
      positivo={signo === '+'}
      logo={{ emoji }}
      onPress={onPress}
    />
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    selectorFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    flechaZona: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.acentoSuave },
    flecha: { fontSize: 26, lineHeight: 30, color: c.primary, fontWeight: '700' },
    flechaOff: { opacity: 0.3 },
    periodo: { flex: 1, fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center' },
    muted: tipoDe(c).nota,
    balance: { fontSize: 14, fontWeight: '800' },
    controles: { flexDirection: 'row' },
    rubro: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14 },
    rubroActivo: { backgroundColor: c.acentoSuave },
    rubroEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
    rubroCuerpo: { flex: 1, gap: 6 },
    rubroFila: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    rubroNombre: { flex: 1, fontSize: 15, fontWeight: '700', color: c.text },
    rubroMonto: { fontSize: 15, fontWeight: '700', color: c.text },
    rubroBarraFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rubroPista: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.panelAlt, overflow: 'hidden' },
    rubroBarra: { height: 8, borderRadius: 4 },
    rubroPct: { fontSize: 12, color: c.muted, minWidth: 34, textAlign: 'right' },
    filtroFila: { flexDirection: 'row' },
    dia: { gap: 8 },
    diaTitulo: { fontSize: 14, fontWeight: '800', color: c.muted, paddingHorizontal: 4 },
  });
