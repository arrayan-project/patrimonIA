import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type DesviacionPresupuestariaDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MetricasHogarDTO,
  type ObjetivoFinancieroDTO,
  type PatrimonioConsolidadoDTO,
  type PatrimonioIndividualDTO,
  type PresupuestoDTO,
  type ResumenFinancieroDTO,
  type SeriePatrimonialDTO,
  type VariacionPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { guardar, leer } from '../auth/secureStorage';
import { money } from '../format';
import { heroHogar } from '../heroHogar';
import { useAlcance } from '../ui/alcance';
import { usePreferencias } from '../preferencias';
import {
  EmptyState,
  ErrorText,
  etiqueta,
  FabMenu,
  GroupLabel,
  Hero,
  IconButton,
  LinkButton,
  MiniGrid,
  MiniPanel,
  MoneyText,
  Panel,
  PillToggle,
  ProgressBar,
  QuickActions,
  Row,
  Screen,
  SelectRow,
  Skeleton,
  TopRow,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';
import { Sparkline } from '../ui/charts';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Categorías funcionales, en el orden en que se muestran en la composición. */
const CATS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'CREDITO', 'DEUDA'] as const;

export function DashboardScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const { alcance, setAlcance } = useAlcance();
  const { preferencias } = usePreferencias();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;
  const claveOnb = `patrimonia.onboarding.${usuario.id}`;

  const [hogares, setHogares] = useState<HogarDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [patrimonio, setPatrimonio] = useState<PatrimonioIndividualDTO | null>(null);
  const [metricas, setMetricas] = useState<MetricasHogarDTO | null>(null);
  const [consolidado, setConsolidado] = useState<PatrimonioConsolidadoDTO | null>(null);
  const [errorHogar, setErrorHogar] = useState<string | null>(null);
  const [variacion, setVariacion] = useState<VariacionPatrimonialDTO | null>(null);
  const [serie, setSerie] = useState<SeriePatrimonialDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [flujo, setFlujo] = useState<{ ingresos: number; gastos: number; moneda: string } | null>(null);
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[]>([]);
  const [presuExcedido, setPresuExcedido] = useState<PresupuestoDTO | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [pasos, setPasos] = useState({ cuenta: false, movimiento: false, objetivo: false });
  const [onbOculto, setOnbOculto] = useState(true);
  const [error, setError] = useState('');

  const elegirHogar = useCallback(
    (id: string) => {
      setHogarId(id);
      void guardar(claveHogar, id);
    },
    [claveHogar],
  );

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      if (lista.length === 0) {
        nav.reset('Bienvenida');
        return;
      }
      setHogares(lista);
      const guardado = await leer(claveHogar);
      const activo = lista.find((h) => h.id === guardado)?.id ?? lista[0].id;
      setHogarId(activo);

      const hoy = new Date();
      const hace90 = new Date(Date.now() - 90 * 86_400_000);
      const q = alcance === 'hogar' ? `&alcance=hogar&hogarId=${activo}` : '&alcance=mios';

      const [h, p, els] = await Promise.all([
        api.get<HogarDTO>(`/hogares/${activo}`, token),
        api.get<PatrimonioIndividualDTO>('/usuarios/me/patrimonio-individual', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      setHogar(h);
      setPatrimonio(p);
      setElementos(els);

      if (alcance === 'hogar') {
        // G33 BUG-HOG: un fallo se informa (no se muestra un 0 falso) y no
        // arrastra a la otra consulta.
        const [m, cons] = await Promise.allSettled([
          api.get<MetricasHogarDTO>(`/hogares/${activo}/metricas`, token),
          api.get<PatrimonioConsolidadoDTO>(`/hogares/${activo}/patrimonio-consolidado`, token),
        ]);
        setMetricas(m.status === 'fulfilled' ? m.value : null);
        setConsolidado(cons.status === 'fulfilled' ? cons.value : null);
        setErrorHogar(
          cons.status === 'rejected'
            ? cons.reason instanceof ApiError
              ? cons.reason.message
              : 'Error inesperado'
            : null,
        );
      }

      try {
        const desde = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        const hasta = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
        const r = await api.get<ResumenFinancieroDTO>(
          `/usuarios/me/resumen-financiero?desde=${desde}&hasta=${hasta}${q}`,
          token,
        );
        const pm = r.porMoneda[0];
        setFlujo(pm ? { ingresos: pm.ingresos, gastos: pm.gastos, moneda: pm.moneda } : null);
      } catch {
        setFlujo(null);
      }

      let objs: ObjetivoFinancieroDTO[] = [];
      try {
        objs = await api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token);
        setObjetivos(objs);
      } catch {
        setObjetivos([]);
      }

      try {
        const presus = await api.get<PresupuestoDTO[]>('/presupuestos', token);
        const vig = presus.find((x) => x.vigente && x.estado !== 'CERRADO');
        if (vig) {
          const d = await api.get<DesviacionPresupuestariaDTO>(`/presupuestos/${vig.id}/desviacion`, token);
          setPresuExcedido(d.real.gastos > d.esperado.gastos && d.esperado.gastos > 0 ? vig : null);
        } else {
          setPresuExcedido(null);
        }
      } catch {
        setPresuExcedido(null);
      }

      try {
        const onbHecho = (await leer(claveOnb)) === 'ok';
        const evs = await api.get<unknown[]>(`/hogares/${activo}/eventos-financieros`, token).catch(() => []);
        const p3 = { cuenta: els.length > 0, movimiento: evs.length > 0, objetivo: objs.length > 0 };
        setPasos(p3);
        setOnbOculto(onbHecho || (p3.cuenta && p3.movimiento && p3.objetivo));
      } catch {
        setOnbOculto(true);
      }

      try {
        setVariacion(
          await api.get<VariacionPatrimonialDTO>(`/usuarios/me/variacion-patrimonial?desde=${iso(hace90)}`, token),
        );
        setSerie(
          await api.get<SeriePatrimonialDTO>(`/usuarios/me/serie-patrimonial?desde=${iso(hace90)}&pasos=8`, token),
        );
      } catch {
        setVariacion(null);
        setSerie(null);
      }
      try {
        const { noLeidas: n } = await api.get<{ noLeidas: number }>(
          '/usuarios/me/notificaciones/no-leidas',
          token,
        );
        setNoLeidas(n);
      } catch {
        setNoLeidas(0);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, nav, claveHogar, claveOnb, alcance]);

  useCargaAlEnfocar(cargar);

  if (!hogar || !patrimonio) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const hoy = new Date();
  const principal =
    patrimonio.porMoneda.find((m) => m.moneda === preferencias.monedaPreferida) ?? patrimonio.porMoneda[0] ?? null;
  const ver = preferencias.dashboard;
  const monedaPrin = alcance === 'hogar' ? hogar.monedaConsolidacion : (principal?.moneda ?? 'CLP');

  // ── Hero ───────────────────────────────────────────────────────────────
  const hh = alcance === 'hogar' ? heroHogar(consolidado, errorHogar, monedaPrin) : null;
  const heroValor = hh
    ? hh.tipo === 'error'
      ? '—'
      : money(hh.monto, hh.moneda)
    : money(principal?.patrimonio ?? 0, monedaPrin);
  const metricasHogar = metricas?.porMoneda.find((m) => m.moneda === monedaPrin);
  const v = principal ? variacion?.porMoneda.find((x) => x.moneda === principal.moneda) : undefined;
  const puntos = principal
    ? (serie?.puntos ?? []).map((pt) => pt.porMoneda.find((m) => m.moneda === principal.moneda)?.patrimonio ?? 0)
    : [];

  // ── Composición ────────────────────────────────────────────────────────
  const composicion: { cat: string; valor: number; sub: string }[] = [];
  if (alcance === 'hogar' && metricasHogar) {
    const m = metricasHogar;
    const act = new Map(m.distribucionPorActivo.map((d) => [d.categoria, d]));
    const pas = new Map(m.distribucionPorPasivo.map((d) => [d.categoria, d]));
    for (const cat of CATS) {
      const d = act.get(cat) ?? pas.get(cat);
      if (d) composicion.push({ cat, valor: d.valor, sub: `${Math.round(d.porcentaje)}%` });
    }
  } else {
    for (const cat of CATS) {
      const delCat = elementos.filter((e) => e.categoriaFuncional === cat);
      if (delCat.length === 0) continue;
      const valor = delCat
        .filter((e) => e.moneda === monedaPrin)
        .reduce((s, e) => s + e.valorVigente, 0);
      composicion.push({ cat, valor, sub: `${delCat.length} ${delCat.length === 1 ? 'elemento' : 'elementos'}` });
    }
  }

  // ── Objetivos ──────────────────────────────────────────────────────────
  const enProgreso = objetivos.filter((o) => o.estado === 'EN_PROGRESO');
  const monedasObj = new Set(enProgreso.map((o) => o.moneda));
  const metaObj = enProgreso.reduce((s, o) => s + o.montoObjetivo, 0);
  const avanceObj = enProgreso.reduce((s, o) => s + o.progreso, 0);
  const pctObj = metaObj > 0 ? Math.round((avanceObj / metaObj) * 100) : 0;

  // ── Alertas (máx 3, por prioridad) ─────────────────────────────────────
  const enMora = elementos.filter(
    (e) => e.estadoOperativo === 'EN_MORA' || e.estadoOperativo === 'INCOBRABLE',
  );
  const alertas: { texto: string; danger?: boolean; onPress: () => void }[] = [];
  if (enMora.length > 0)
    alertas.push({
      texto: `${enMora.length} ${enMora.length === 1 ? 'deuda' : 'deudas'} en mora`,
      danger: true,
      onPress: () => nav.go('ElementoDetalle', { elementoId: enMora[0].id }),
    });
  if (presuExcedido)
    alertas.push({
      texto: `Presupuesto de ${MESES[hoy.getMonth()]} excedido`,
      danger: true,
      onPress: () => nav.go('PresupuestoDetalle', { presupuestoId: presuExcedido.id }),
    });
  if (noLeidas > 0)
    alertas.push({
      texto: `${noLeidas} ${noLeidas === 1 ? 'notificación sin leer' : 'notificaciones sin leer'}`,
      onPress: () => nav.go('Notificaciones'),
    });

  // G32 H-03/H-08 — una sola entrada a "Mi patrimonio" (todas las cuentas y bienes + evolución).
  const verPatrimonio = () => nav.go('PatrimonioSeccion', { alcance, moneda: monedaPrin });

  const cerrarOnboarding = () => {
    setOnbOculto(true);
    void guardar(claveOnb, 'ok');
  };

  return (
    <Screen
      onRefresh={cargar}
      fab={
        <FabMenu
          actions={[
            { icon: 'swap-vertical-outline', label: 'Registrar movimiento', onPress: () => nav.go('RegistrarMovimiento') },
            { icon: 'add-circle-outline', label: 'Agregar cuenta o bien', onPress: () => nav.go('AgregarElemento') },
          ]}
        />
      }
    >
      <TopRow
        left={
          <PillToggle
            options={['mios', 'hogar'] as const}
            value={alcance}
            onChange={setAlcance}
            format={(x) => (x === 'mios' ? 'Míos' : 'Del hogar')}
          />
        }
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

      <Pressable
        onPress={verPatrimonio}
        accessibilityRole="button"
        accessibilityLabel="Ver mi patrimonio completo"
      >
        <Hero
          label={alcance === 'hogar' ? `${hogar.nombre} · patrimonio` : 'Patrimonio neto'}
          value={heroValor}
          change={
            alcance === 'mios' && v && v.variacion !== 0
              ? `${v.variacion >= 0 ? '▲' : '▼'} ${
                  v.variacionPorcentaje != null
                    ? `${Math.abs(v.variacionPorcentaje)}%`
                    : money(Math.abs(v.variacion), monedaPrin)
                }`
              : undefined
          }
          changeDir={v && v.variacion < 0 ? 'neg' : 'pos'}
        >
          {alcance === 'mios' && puntos.length >= 2 ? <Sparkline valores={puntos} /> : null}
        </Hero>
      </Pressable>

      {hh?.tipo === 'error' && <ErrorText>{hh.mensaje}</ErrorText>}
      {hh?.tipo === 'parcial' && (
        <ErrorText>{`Total parcial en ${hh.moneda}: falta tipo de cambio para ${hh.faltantes.join(', ')}.`}</ErrorText>
      )}

      {alertas.length > 0 && (
        <Panel gap={0}>
          {alertas.slice(0, 3).map((a, i) => (
            <Pressable
              key={i}
              onPress={a.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [styles.alerta, i > 0 && styles.alertaSep, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.alertaPunto, { backgroundColor: a.danger ? c.danger : c.muted }]} />
              <Text style={styles.alertaTxt}>{a.texto}</Text>
              <Text style={styles.alertaChev}>›</Text>
            </Pressable>
          ))}
          {alertas.length > 3 && (
            <Pressable style={styles.alerta} onPress={() => nav.go('Notificaciones')} accessibilityRole="button" accessibilityLabel={`Ver todas las alertas (${alertas.length})`}>
              <Text style={[styles.alertaTxt, { color: c.muted }]}>Ver todas ({alertas.length})</Text>
            </Pressable>
          )}
        </Panel>
      )}

      {!onbOculto && (
        <Panel>
          <View style={styles.headRow}>
            <Text style={styles.section}>Primeros pasos</Text>
            <Pressable hitSlop={8} onPress={cerrarOnboarding} accessibilityRole="button" accessibilityLabel="Ocultar primeros pasos">
              <Text style={styles.muted}>Ocultar</Text>
            </Pressable>
          </View>
          <Paso hecho={pasos.cuenta} texto="Agrega tu primera cuenta o bien" onPress={() => nav.go('AgregarElemento')} c={c} styles={styles} />
          <Paso hecho={pasos.movimiento} texto="Registra un movimiento" onPress={() => nav.go('RegistrarMovimiento')} c={c} styles={styles} />
          <Paso hecho={pasos.objetivo} texto="Crea un objetivo de ahorro" onPress={() => nav.go('Objetivos', { nuevo: true })} c={c} styles={styles} />
          <Text style={styles.muted}>
            Abajo tienes 4 secciones: Inicio (cuánto tienes), Movimientos (ingresos y
            gastos), Planificar (metas, presupuesto y pagos futuros) y Hogar (lo que
            compartes con tu familia).
          </Text>
        </Panel>
      )}

      {hogares.length > 1 && (
        <Panel>
          <Text style={styles.section}>Hogar activo</Text>
          {hogares.map((h) => (
            <SelectRow key={h.id} label={h.nombre} selected={h.id === hogarId} onPress={() => elegirHogar(h.id)} />
          ))}
        </Panel>
      )}

      {ver.composicion && (
        <GroupLabel
          right={composicion.length > 0 ? <LinkButton title="Ver todo ›" onPress={verPatrimonio} /> : undefined}
        >
          Composición
        </GroupLabel>
      )}
      {!ver.composicion ? null : composicion.length === 0 && alcance === 'mios' ? (
        <EmptyState
          icon="wallet-outline"
          titulo="Aún no tienes cuentas ni bienes"
          descripcion="Agrega tu primera cuenta, inversión o deuda para empezar."
          accion="Agregar mi primera cuenta"
          onAccion={() => nav.go('AgregarElemento')}
        />
      ) : composicion.length === 0 ? (
        <Panel>
          <Text style={styles.muted}>Sin desglose disponible para el patrimonio del hogar.</Text>
        </Panel>
      ) : (
        <MiniGrid>
          {composicion.map((x) => (
            <MiniPanel
              key={x.cat}
              label={etiqueta(x.cat)}
              value={money(Math.abs(x.valor), monedaPrin)}
              sub={x.sub}
              tone={x.valor < 0 ? 'danger' : undefined}
              onPress={() =>
                nav.go('PatrimonioSeccion', { categoria: x.cat, alcance, moneda: monedaPrin })
              }
            />
          ))}
        </MiniGrid>
      )}

      {ver.disponibilidad && alcance === 'mios' && principal && (
        <Panel>
          <Text style={styles.section}>Disponibilidad</Text>
          <View style={styles.dispRow}>
            <Disp label="Líquido" valor={money(principal.valorLiquido, principal.moneda)} styles={styles} />
            <Disp label="Apartado" valor={money(principal.valorReservado, principal.moneda)} styles={styles} onPress={() => nav.go('Planificar')} />
            <Disp label="Disponible" valor={money(principal.valorLibre, principal.moneda)} styles={styles} strong />
          </View>
          <Text style={styles.muted}>“Apartado” es plata separada para tus metas: sigue en la cuenta, pero comprometida.</Text>
        </Panel>
      )}

      {ver.flujo && (
        <Panel>
          <View style={styles.headRow}>
            <Text style={styles.section}>Flujo de {MESES[hoy.getMonth()]}</Text>
            <Pressable hitSlop={8} onPress={() => nav.go('Movimientos')} accessibilityRole="button" accessibilityLabel="Ver movimientos">
              <Text style={styles.link}>Ver movimientos ›</Text>
            </Pressable>
          </View>
          {flujo ? (
            <>
              <Row left="Ingresos" right={money(flujo.ingresos, flujo.moneda)} />
              <Row left="Gastos" right={money(flujo.gastos, flujo.moneda)} />
              <Row
                left="Balance"
                right={<MoneyText monto={flujo.ingresos - flujo.gastos} moneda={flujo.moneda} style={styles.balance} />}
              />
            </>
          ) : (
            <Text style={styles.muted}>Sin movimientos este mes.</Text>
          )}
        </Panel>
      )}

      {ver.objetivos && enProgreso.length > 0 && monedasObj.size === 1 && (
        <Panel>
          <View style={styles.headRow}>
            <Text style={styles.section}>Objetivos</Text>
            <Pressable hitSlop={8} onPress={() => nav.go('Planificar')} accessibilityRole="button" accessibilityLabel="Ir a Planificar">
              <Text style={styles.link}>Planificar ›</Text>
            </Pressable>
          </View>
          <ProgressBar pct={pctObj} />
          <Text style={styles.muted}>
            {money(avanceObj, [...monedasObj][0])} de {money(metaObj, [...monedasObj][0])} · {pctObj}% · {enProgreso.length}{' '}
            {enProgreso.length === 1 ? 'objetivo' : 'objetivos'}
          </Text>
        </Panel>
      )}

      {ver.accesos && (
        <>
          <GroupLabel>Accesos rápidos</GroupLabel>
          <QuickActions
            items={[
              { icon: 'swap-vertical-outline', label: 'Movimiento', onPress: () => nav.go('RegistrarMovimiento') },
              { icon: 'flag-outline', label: 'Objetivos', onPress: () => nav.go('Objetivos') },
              { icon: 'calendar-outline', label: 'Programados', onPress: () => nav.go('MovimientosProgramados') },
              { icon: 'wallet-outline', label: 'Mi patrimonio', onPress: verPatrimonio },
            ]}
          />
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function Paso({
  hecho,
  texto,
  onPress,
  c,
  styles,
}: {
  hecho: boolean;
  texto: string;
  onPress: () => void;
  c: Paleta;
  styles: ReturnType<typeof crearEstilos>;
}) {
  return (
    <Pressable style={styles.paso} onPress={onPress} accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ checked: hecho }}>
      <Text style={{ fontSize: 15 }}>{hecho ? '✓' : '○'}</Text>
      <Text style={[styles.pasoTxt, hecho && { color: c.mutedDim, textDecorationLine: 'line-through' }]}>{texto}</Text>
    </Pressable>
  );
}

function Disp({
  label,
  valor,
  strong,
  onPress,
  styles,
}: {
  label: string;
  valor: string;
  strong?: boolean;
  onPress?: () => void;
  styles: ReturnType<typeof crearEstilos>;
}) {
  const cuerpo = (
    <>
      <Text style={styles.dispLbl}>{label}</Text>
      <Text style={[styles.dispVal, strong && styles.dispValStrong]}>{valor}</Text>
    </>
  );
  return onPress ? (
    <Pressable style={styles.dispCol} onPress={onPress} accessibilityRole="button">
      {cuerpo}
    </Pressable>
  ) : (
    <View style={styles.dispCol}>{cuerpo}</View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    section: tipoDe(c).seccion,
    muted: tipoDe(c).nota,
    link: { fontSize: 13, color: c.text, fontWeight: '600' },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balance: { fontSize: 14, fontWeight: '700' },
    paso: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    pasoTxt: { fontSize: 14, color: c.text },
    alerta: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
    alertaSep: { borderTopWidth: 1, borderTopColor: c.panelAlt },
    alertaPunto: { width: 7, height: 7, borderRadius: 4 },
    alertaTxt: { flex: 1, fontSize: 14, color: c.text, fontWeight: '500' },
    alertaChev: { fontSize: 18, color: c.mutedDim },
    dispRow: { flexDirection: 'row', gap: 8 },
    dispCol: { flex: 1, gap: 3 },
    dispLbl: { fontSize: 11, color: c.mutedDim, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    dispVal: { fontSize: 15, color: c.muted, fontWeight: '600' },
    dispValStrong: { color: c.text, fontWeight: '800' },
  });
