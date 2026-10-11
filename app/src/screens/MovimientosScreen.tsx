import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { TITULO_ANOTAR, useAnotar } from '../hooks/useAnotar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type FotoMesDTO,
  type HogarDTO,
  type MovimientoReporteDTO,
  type ResumenAnualDTO,
  type ResumenFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { pasesConPersonas, quedaDelMes } from '../flujoMes';
import { cicloDe, MESES_LARGO, rotuloCiclo, ventanaCiclo, type CicloMes } from '../cicloMes';
import { agruparFoto, cuentasDelDia, elegiblesDelDia, rotuloLinea } from '../fotoMes';
import { usePreferencias } from '../preferencias';
import { emojiElemento } from '../emojis';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useAlcance } from '../ui/alcance';
import { emojiCategoria, emojiTipoMovimiento } from '../emojis';
import {
  Button,
  colorCategoria,
  ElegirVarios,
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
/** G43: el día del mes del hogar, recordado entre visitas (así no se carga dos veces). */
let diaHogarRecordado = 1;
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

/** Pestaña Movimientos: obedece al lente "Lo mío · Del hogar" (L-1). */
export function MovimientosScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const anotar = useAnotar();
  const ctxAlcance = useAlcance();
  const alcance = ctxAlcance.alcance;

  const hoy = useMemo(() => new Date(), []);
  const { preferencias, guardarPreferencias } = usePreferencias();
  const hogar = alcance === 'hogar';
  // G43: el mes parte el día que elegiste (o el del hogar en "Del hogar").
  const [diaHogar, setDiaHogar] = useState(diaHogarRecordado);
  const ciclo: CicloMes = useMemo(
    () => ({ dia: hogar ? diaHogar : preferencias.mes.dia, nombre: preferencias.mes.nombre }),
    [hogar, diaHogar, preferencias.mes.dia, preferencias.mes.nombre],
  );
  const [periodo, setPeriodo] = useState<Periodo>('Mes');
  // null = el mes de hoy (según el ciclo, que puede llegar después).
  const [anchorElegido, setAnchor] = useState<{ anio: number; mes: number } | null>(null);
  const anchor = useMemo(() => anchorElegido ?? cicloDe(hoy, ciclo), [anchorElegido, hoy, ciclo]);
  const [mesesAtras, setMesesAtras] = useState(3);
  // G42: tus cuentas, para la foto del mes de las del día a día.
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [foto, setFoto] = useState<FotoMesDTO | null>(null);
  const [resultadoPrev, setResultadoPrev] = useState<number | null>(null);

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
    const [a, m, d] = mesParam.split('-').map(Number);
    setPeriodo('Mes');
    setAnchor(d ? cicloDe(new Date(a, m - 1, d), ciclo) : { anio: a, mes: m - 1 });
  }, [mesParam, ciclo]);

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
    return ventanaCiclo(anchor.anio, anchor.mes, ciclo);
  }, [periodo, anchor, mesesAtras, hoy, ciclo]);

  const cargar = useCallback(async () => {
    setError('');
    setCargando(true);
    try {
      const [hs, els] = await Promise.all([
        api.get<HogarDTO[]>('/usuarios/me/hogares', token),
        hogar ? Promise.resolve(null) : api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      let hid = hogarIdRef.current;
      if (!hid) {
        hid = hs[0]?.id ?? null;
        hogarIdRef.current = hid;
      }
      const dia = hs.find((h) => h.id === hid)?.diaInicioMes ?? 1;
      diaHogarRecordado = dia;
      setDiaHogar(dia);
      // G42: en "Lo mío", todo se mira en tus cuentas del día a día.
      const cuentas = els ? cuentasDelDia(els, preferencias.mes.cuentas) : null;
      if (els) setElementos(els);
      const q =
        alcance === 'hogar' && hid ? `&alcance=hogar&hogarId=${hid}` : `&alcance=mios&cuentas=${(cuentas ?? []).join(',')}`;
      const pedirFoto = (v: { desde: string; hasta: string }) =>
        api.get<FotoMesDTO>(`/usuarios/me/foto-mes?desde=${v.desde}&hasta=${v.hasta}&cuentas=${(cuentas ?? []).join(',')}`, token);

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

      if (periodo === 'Mes' && !hogar) {
        // G41: la foto del mes (y la del mes anterior, para comparar).
        const prev = ventanaCiclo(anchor.anio, anchor.mes - 1, ciclo);
        const [r, f, fp] = await Promise.all([
          pedirResumen(desde, hasta),
          pedirFoto(ventana),
          pedirFoto(prev).catch(() => null),
        ]);
        setResumen(r);
        setFoto(f);
        setAnual(null);
        setBalancePrev(null);
        const principalPrev = fp ? monedaDeFoto(fp, preferencias.monedaPreferida) : null;
        setResultadoPrev(principalPrev ? principalPrev.tienes - principalPrev.tenias : null);
      } else if (periodo === 'Mes') {
        const prev = ventanaCiclo(anchor.anio, anchor.mes - 1, ciclo);
        const [r, p] = await Promise.all([pedirResumen(desde, hasta), pedirResumen(prev.desde, prev.hasta).catch(() => null)]);
        setResumen(r);
        setFoto(null);
        setAnual(null);
        setBalancePrev(p ? p.porMoneda.reduce((s, m) => s + m.balance, 0) : null);
      } else if (periodo === 'Año') {
        const [r, a] = await Promise.all([
          pedirResumen(desde, hasta),
          api.get<ResumenAnualDTO>(`/usuarios/me/resumen-anual?anio=${anchor.anio}${q}`, token),
        ]);
        setResumen(r);
        setFoto(null);
        setAnual(a);
        setBalancePrev(null);
      } else {
        setResumen(await pedirResumen(desde, hasta));
        setFoto(null);
        setAnual(null);
        setBalancePrev(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  }, [token, periodo, anchor, ventana, alcance, hogar, ciclo, preferencias.mes.cuentas, preferencias.monedaPreferida]);

  useCargaAlEnfocar(cargar);

  const mover = (delta: number) => {
    const a = anchor;
    if (periodo === 'Año') return setAnchor({ ...a, anio: a.anio + delta });
    let mes = a.mes + delta;
    let anio = a.anio;
    if (mes < 0) { mes = 11; anio--; }
    else if (mes > 11) { mes = 0; anio++; }
    setAnchor({ anio, mes });
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
  const mesDeHoy = cicloDe(hoy, ciclo);
  const enCurso =
    periodo === 'Recientes' ||
    (periodo === 'Año' ? anchor.anio === hoy.getFullYear() : anchor.anio === mesDeHoy.anio && anchor.mes === mesDeHoy.mes);
  const rotulo = periodo === 'Mes' ? rotuloCiclo(anchor.anio, anchor.mes, ciclo) : null;
  const tituloResumen =
    periodo === 'Recientes'
      ? `Así van los últimos ${mesesAtras} meses`
      : `${enCurso ? 'Así va' : 'Así fue'} ${etiquetaPeriodo}`;

  const totales = resumen
    ? resumen.porMoneda.reduce(
        (s, m) => ({ ingresos: s.ingresos + m.ingresos, gastos: s.gastos + m.gastos }),
        { ingresos: 0, gastos: 0 },
      )
    : null;
  const monedaPrincipal = resumen?.porMoneda[0]?.moneda ?? 'CLP';
  // G39 (claridad): lo que pasaste o te pasaron personas del hogar también cuenta en el mes.
  const pases = hogar ? [] : pasesConPersonas(resumen?.movimientos ?? [], monedaPrincipal);
  const balance = totales ? quedaDelMes(totales.ingresos, totales.gastos, pases) : 0;
  const multiMoneda = (resumen?.porMoneda.length ?? 0) > 1;
  const mesAnterior = MESES_LARGO[anchor.mes === 0 ? 11 : anchor.mes - 1];
  const contraAnterior = balancePrev != null ? balance - balancePrev : null;

  const gastosRubro = (resumen?.porRubro ?? [])
    .filter((r) => r.tipo === 'GASTO' && r.total > 0)
    .sort((a, b) => b.total - a.total);
  // H1: lo privado de otros miembros, sin detalle — una línea 🔒 por dueño.
  const privados = (resumen?.privados ?? []).filter((x) => x.moneda === monedaPrincipal);
  const privadosGasto = privados.filter((x) => x.gastos > 0);
  const totalRubros =
    gastosRubro.reduce((s, r) => s + r.total, 0) + privadosGasto.reduce((s, x) => s + x.gastos, 0);
  const rubrosVisibles = verTodosRubros ? gastosRubro : gastosRubro.slice(0, RUBROS_A_LA_VISTA);
  const emojiDe = (categoriaId: string | null, tipo: string) =>
    emojiCategoria(categoriaId ? catPorId.get(categoriaId) : null) ?? emojiTipoMovimiento(tipo);
  const filtrarCategoria = (f: FiltroCategoria | null) => {
    setCatFiltro(f);
    // Si se había llegado filtrado desde otra pantalla, se limpian esos parámetros.
    if (!f && categoriaParam) nav.go('Movimientos', { categoriaId: undefined, categoriaNombre: undefined, mes: undefined });
  };

  return (
    <Screen onRefresh={cargar} fab={<FabMenu titulo={TITULO_ANOTAR} actions={anotar.acciones} />}>
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
      {/* L-4: con un solo miembro en el hogar, no hay lente. */}
      {ctxAlcance.lente && (
        <View style={styles.controles}>
          <PillToggle
            options={['mios', 'hogar'] as const}
            value={alcance}
            onChange={ctxAlcance.setAlcance}
            format={(x) => (x === 'mios' ? 'Lo mío' : 'Del hogar')}
          />
        </View>
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
        <View style={styles.periodoCaja}>
          <Text style={styles.periodo} numberOfLines={1}>🗓️ {titulo.charAt(0).toUpperCase() + titulo.slice(1)}</Text>
          {rotulo ? <Text style={styles.rotulo}>{rotulo}</Text> : null}
        </View>
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
          {foto ? (
            <FotoDelMes
              titulo={tituloResumen}
              foto={foto}
              enCurso={enCurso}
              monedaPreferida={preferencias.monedaPreferida}
              resultadoPrev={resultadoPrev}
              mes={etiquetaPeriodo}
              mesAnterior={mesAnterior}
              selector={
                <ElegirVarios
                  label="¿Qué cuentas entran en los cálculos?"
                  values={cuentasDelDia(elementos, preferencias.mes.cuentas)}
                  options={elegiblesDelDia(elementos).map((e) => ({
                    value: e.id,
                    label: `${emojiElemento(e, preferencias.emojis.elementos)} ${e.nombre}`,
                  }))}
                  onChange={(cuentas) =>
                    void guardarPreferencias({ ...preferencias, mes: { ...preferencias.mes, cuentas } }).catch(() => undefined)
                  }
                  boton={(abrir) => (
                    <Pastilla
                      label={`💳 ${nombresCuentas(elementos, foto.cuentas)} · Cambiar`}
                      accessibilityLabel="Elegir tus cuentas del día a día"
                      onPress={abrir}
                    />
                  )}
                />
              }
            />
          ) : (
          <Section title={tituloResumen}>
            <Panel gap={0}>
              <Row left={hogar ? '📥 Les entró' : '📥 Te entró'} right={money(totales?.ingresos ?? 0, monedaPrincipal)} />
              <Row left={hogar ? '📤 Gastaron' : '📤 Gastaste'} right={money(totales?.gastos ?? 0, monedaPrincipal)} />
              {pases.map((p) => (
                <Row
                  key={`${p.usuarioId}${p.monto < 0 ? '-' : '+'}`}
                  left={p.monto < 0 ? `👤 Le pasaste a ${p.nombre}` : `👤 Te pasó ${p.nombre}`}
                  right={`${p.monto < 0 ? '−' : '+'} ${money(Math.abs(p.monto), monedaPrincipal)}`}
                />
              ))}
              <Row
                left={
                  balance >= 0
                    ? `🧮 ${hogar ? 'Les' : 'Te'} ${enCurso ? 'queda' : 'quedó'} ${periodo === 'Año' ? 'del año' : periodo === 'Mes' ? `de ${etiquetaPeriodo}` : ''}`.trim()
                    : '⚠️ Salió más de lo que entró'
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
          )}
          {multiMoneda && !foto && (
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

          {(gastosRubro.length > 0 || privadosGasto.length > 0) && (
            <Section
              title={hogar ? '¿En qué gastaron?' : '¿En qué gastaste?'}
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
                {/* H1: lo privado va como rubro aparte y no abre detalle. */}
                {privadosGasto.map((x) => {
                  const pct = totalRubros > 0 ? x.gastos / totalRubros : 0;
                  return (
                    <View
                      key={`privado-${x.usuarioId}`}
                      style={styles.rubro}
                      accessibilityLabel={`Movimientos privados de ${x.nombre}: ${money(x.gastos, monedaPrincipal)}`}
                    >
                      <Text style={styles.rubroEmoji}>🔒</Text>
                      <View style={styles.rubroCuerpo}>
                        <View style={styles.rubroFila}>
                          <Text style={[styles.rubroNombre, { flexShrink: 1 }]} numberOfLines={2}>{`Movimientos privados de ${x.nombre}`}</Text>
                          <Text style={styles.rubroMonto}>{money(x.gastos, monedaPrincipal)}</Text>
                        </View>
                        <View style={styles.rubroBarraFila}>
                          <View style={styles.rubroPista}>
                            <View style={[styles.rubroBarra, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: c.mutedDim }]} />
                          </View>
                          <Text style={styles.rubroPct}>{pct > 0 && pct < 0.01 ? '<1%' : `${Math.round(pct * 100)}%`}</Text>
                        </View>
                      </View>
                    </View>
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

          {/* H1: lo privado de otros miembros, sin detalle, arriba de la lista (sin filtros ni búsqueda). */}
          {privados.length > 0 && filtro === 'Todo' && !catFiltro && !busca.trim() && (
            <ListCard>
              {privados.map((x) => (
                <TxRow
                  key={`privado-${x.usuarioId}`}
                  title={`Movimientos privados de ${x.nombre}`}
                  subtitle={[
                    x.ingresos > 0 ? `Entró ${money(x.ingresos, x.moneda)}` : '',
                    x.gastos > 0 ? `Salió ${money(x.gastos, x.moneda)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  amount=""
                  logo={{ emoji: '🔒' }}
                />
              ))}
            </ListCard>
          )}

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

type MonedaFoto = FotoMesDTO['porMoneda'][number];

/** La moneda que se muestra: la preferida si hay cuentas en ella, si no la de más plata. */
function monedaDeFoto(f: FotoMesDTO, preferida: string | null): MonedaFoto | null {
  return (
    f.porMoneda.find((m) => m.moneda === preferida) ??
    [...f.porMoneda].sort((a, b) => Math.abs(b.tienes) - Math.abs(a.tienes))[0] ??
    null
  );
}

/** "Banco de Chile, Visa" o "3 cuentas". */
function nombresCuentas(els: ElementoPatrimonialDTO[], ids: string[]): string {
  if (ids.length === 0) return 'Elige tus cuentas';
  if (ids.length > 2) return `${ids.length} cuentas`;
  return ids.map((id) => els.find((e) => e.id === id)?.nombre ?? 'Cuenta').join(', ');
}

/**
 * G41 — cómo se mueve tu mes, desde lo que te entró (el sueldo) hasta el último
 * peso: Entró − Salió = Te queda de este mes. Lo que sobró de meses anteriores
 * se cuenta aparte, sin mezclarse con el mes (Juan, 2026-10-10: es para gente
 * común, no para contadores). Entró, Salió y Te queda son los mismos números de
 * la tarjeta del mes en el Inicio.
 */
function FotoDelMes({
  titulo,
  foto,
  enCurso,
  monedaPreferida,
  resultadoPrev,
  mes,
  mesAnterior,
  selector,
}: {
  titulo: string;
  foto: FotoMesDTO;
  enCurso: boolean;
  monedaPreferida: string | null;
  resultadoPrev: number | null;
  mes: string;
  mesAnterior: string;
  selector: ReactNode;
}) {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const m = monedaDeFoto(foto, monedaPreferida);
  const otras = foto.porMoneda.filter((x) => x !== m).map((x) => x.moneda);
  if (!m) {
    return (
      <Section title={titulo}>
        <View style={styles.filtroFila}>{selector}</View>
        <Text style={styles.muted}>Elige las cuentas con que pagas tu día a día para ver cómo va tu mes.</Text>
      </Section>
    );
  }
  const g = agruparFoto(m.lineas);
  const queda = g.entro - g.salio;
  const linea = (l: (typeof m.lineas)[number]) => (
    <View key={`${l.clase}${l.monto > 0 ? '+' : '-'}${l.persona?.usuarioId ?? ''}`} style={styles.subFila}>
      <Text style={styles.subTexto} numberOfLines={1}>{rotuloLinea(l)}</Text>
      <Text style={styles.subMonto}>{money(Math.abs(l.monto), m.moneda)}</Text>
    </View>
  );
  return (
    <Section title={titulo}>
      <View style={styles.filtroFila}>{selector}</View>
      <Panel gap={0}>
        <Row left="📥 Te entró" right={<Text style={[styles.balance, { color: c.ok }]}>{`+ ${money(g.entro, m.moneda)}`}</Text>} />
        {g.lineasEntro.map(linea)}
        <Row left="📤 Salió" right={<Text style={[styles.balance, { color: c.danger }]}>{`− ${money(g.salio, m.moneda)}`}</Text>} />
        {g.lineasSalio.map(linea)}
        <Row
          left={queda >= 0 ? `🧮 ${enCurso ? 'Te queda' : 'Te sobró'} de ${mes}` : '⚠️ Salió más de lo que entró'}
          right={
            <Text style={[styles.balance, { color: queda >= 0 ? c.ok : c.danger }]}>
              {`${queda >= 0 ? '' : '− '}${money(Math.abs(queda), m.moneda)}`}
            </Text>
          }
        />
      </Panel>
      {resultadoPrev != null && (
        <Text style={styles.muted}>
          {resultadoPrev >= 0
            ? `En ${mesAnterior} te sobraron ${money(resultadoPrev, m.moneda)}.`
            : `En ${mesAnterior} salió ${money(-resultadoPrev, m.moneda)} más de lo que entró.`}
        </Text>
      )}
      {/* Lo de meses anteriores, aparte: no se mezcla con el mes. */}
      <Text style={styles.muted}>
        {`${m.tenias >= 0 ? `Aparte, de meses anteriores te quedaban ${money(m.tenias, m.moneda)}` : `Empezaste ${mes} debiendo ${money(-m.tenias, m.moneda)} en estas cuentas`}. ${
          enCurso ? 'Hoy tienes' : 'Terminaste con'
        } ${money(m.tienes, m.moneda)} en estas cuentas${enCurso && m.apartadoMetas > 0 ? `, ${money(m.apartadoMetas, m.moneda)} apartados para tus metas` : ''}.`}
      </Text>
      {otras.length > 0 && (
        <Text style={styles.muted}>{`Tus cuentas en ${otras.join(', ')} no se suman aquí: están en otra moneda.`}</Text>
      )}
    </Section>
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
    // G39 (claridad): con alguien del hogar, se dice con quién.
    sub = hogar
      ? e === 0 ? 'Entre cuentas del hogar' : e < 0 ? 'Salió del hogar' : 'Entró al hogar'
      : m.contraparte
        ? e < 0 ? `👤 Le pasaste a ${m.contraparte.nombre}` : `👤 Te pasó ${m.contraparte.nombre}`
        : // G42: "tus cuentas" son las del día a día; el otro lado es otra cuenta tuya.
          e === 0 ? 'Entre tus cuentas' : e < 0 ? 'A tus otras cuentas' : 'Desde tus otras cuentas';
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
    periodoCaja: { flex: 1, alignItems: 'center' },
    periodo: { fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center' },
    rotulo: { fontSize: 13, color: c.muted },
    subFila: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingLeft: 28, paddingVertical: 3 },
    subTexto: { fontSize: 13, color: c.muted, flexShrink: 1 },
    subMonto: { fontSize: 13, color: c.muted },
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
