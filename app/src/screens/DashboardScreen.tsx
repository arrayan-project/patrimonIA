import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { TITULO_ANOTAR, useAnotar } from '../hooks/useAnotar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type DesviacionPresupuestariaDTO,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
  type FotoMesDTO,
  type MovimientoReporteDTO,
  type MovimientoProgramadoDTO,
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
import { aportesComoPases, pasesConPersonas, quedaDelMes, type AporteHogar } from '../flujoMes';
import { cicloDe, MESES_LARGO, rotuloCiclo, ventanaCiclo, type CicloMes } from '../cicloMes';
import { agruparFoto, cuentasDelDia } from '../fotoMes';
import { useNav } from '../navigation/navigator';
import { guardar, leer } from '../auth/secureStorage';
import { money } from '../format';
import { heroHogar } from '../heroHogar';
import { useAlcance } from '../ui/alcance';
import { usePreferencias } from '../preferencias';
import {
  AnilloAvance,
  thumbWeb,
  Elegir,
  fechaLegible,
  EmptyState,
  ErrorText,
  etiqueta,
  FabMenu,
  Hero,
  IconButton,
  ListCard,
  MenuList,
  Panel,
  panelDe,
  tinte,
  Pastilla,
  aISO,
  PillToggle,
  QuickActions,
  Row,
  Screen,
  Section,
  Skeleton,
  TopRow,
  TxRow,
  useC,
  type Paleta,
  tipoDe,
  tipografia,
} from '../ui';
import { Sparkline } from '../ui/charts';
import type { SolicitudDTO } from '../solicitudes';
import { cargarEntreMiembros, type EntreMiembros } from '../entreMiembros';
import { cargarCuentasHogar } from '../cuentasHogar';
import { FilaEntreRow } from './EntreMiembrosScreen';
import { invitarAlHogar } from './GestionHogarScreen';
import { useToast } from '../ui/Toast';
import { fechaCorta, tituloProgramado } from './MovimientosProgramadosScreen';
import {
  EMOJI_CATEGORIA_FUNCIONAL,
  NOMBRE_CATEGORIA_FUNCIONAL,
  emojiCategoria,
  emojiElemento,
  emojiMeta,
  emojiTipoMovimiento,
} from '../emojis';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** G43: el mes de "Lo mío" parte el día que elegiste; el de "Del hogar", el del hogar. */
function cicloDeAlcance(alcance: string, hogar: HogarDTO | null, mes: { dia: number; nombre: CicloMes['nombre'] }): CicloMes {
  return { dia: alcance === 'hogar' ? (hogar?.diaInicioMes ?? 1) : mes.dia, nombre: mes.nombre };
}


/** Categorías funcionales, en el orden en que se muestran en la composición. */
const CATS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'CREDITO', 'DEUDA'] as const;

export function DashboardScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const anotar = useAnotar();
  const nav = useNav();
  const { alcance, setAlcance, lente, setSoloUnMiembro } = useAlcance();
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
  // L1 (S04): lo que era propio de la pestaña Hogar — "Entre [miembro] y tú" y
  // las cuentas de los otros miembros a las que puedes transferir.
  const [entre, setEntre] = useState<EntreMiembros | null>(null);
  const [paraTransferir, setParaTransferir] = useState<ElementoPatrimonialDTO[]>([]);
  const [variacion, setVariacion] = useState<VariacionPatrimonialDTO | null>(null);
  const [serie, setSerie] = useState<SeriePatrimonialDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [flujo, setFlujo] = useState<{ ingresos: number; gastos: number; moneda: string } | null>(null);
  // G35: los movimientos del mes (todas tus cuentas) y las categorías, para sus emojis.
  const [movsMes, setMovsMes] = useState<MovimientoReporteDTO[]>([]);
  // G45 H2: en "Del hogar", lo que entró al hogar y salió de él (aportes), por persona.
  const [aportesMes, setAportesMes] = useState<AporteHogar[]>([]);
  // G41: en "Lo mío", la foto del mes de tus cuentas del día a día (G42).
  const [fotoMes, setFotoMes] = useState<{ entro: number; salio: number; moneda: string } | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[]>([]);
  const [presuExcedido, setPresuExcedido] = useState<PresupuestoDTO | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  // G33 bloque 9: lo que un miembro te pide que anotes (su parte, una transferencia).
  const [porPagar, setPorPagar] = useState<SolicitudDTO[]>([]);
  // G39 (F-3): lo programado que ya tocaba, para confirmarlo aquí con un toque.
  const [porConfirmar, setPorConfirmar] = useState<MovimientoProgramadoDTO[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const toast = useToast();
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
      // L-4: con un solo miembro no hay lente (Movimientos y Planificar lo leen de aquí).
      if (h.miembros) setSoloUnMiembro(h.miembros.length === 1);
      setPatrimonio(p);
      setElementos(els);

      if (alcance === 'hogar') {
        // G33 BUG-HOG: un fallo se informa (no se muestra un 0 falso) y no
        // arrastra a la otra consulta.
        const [m, cons, en, ch] = await Promise.allSettled([
          api.get<MetricasHogarDTO>(`/hogares/${activo}/metricas`, token),
          api.get<PatrimonioConsolidadoDTO>(`/hogares/${activo}/patrimonio-consolidado`, token),
          cargarEntreMiembros(token, usuario.id, activo),
          cargarCuentasHogar(token),
        ]);
        setMetricas(m.status === 'fulfilled' ? m.value : null);
        setConsolidado(cons.status === 'fulfilled' ? cons.value : null);
        setEntre(en.status === 'fulfilled' ? en.value : null);
        setParaTransferir(ch.status === 'fulfilled' ? ch.value.paraTransferir : []);
        setErrorHogar(
          cons.status === 'rejected'
            ? cons.reason instanceof ApiError
              ? cons.reason.message
              : 'Error inesperado'
            : null,
        );
      }

      try {
        // G43: el mes de hoy según el día en que parte (el tuyo o el del hogar).
        const ciclo = cicloDeAlcance(alcance, h, preferencias.mes);
        const m = cicloDe(hoy, ciclo);
        const { desde, hasta } = ventanaCiclo(m.anio, m.mes, ciclo);
        const cuentas = cuentasDelDia(els, preferencias.mes.cuentas).join(',');
        const [r, f] = await Promise.all([
          api.get<ResumenFinancieroDTO>(`/usuarios/me/resumen-financiero?desde=${desde}&hasta=${hasta}${q}`, token),
          alcance === 'mios'
            ? api.get<FotoMesDTO>(`/usuarios/me/foto-mes?desde=${desde}&hasta=${hasta}&cuentas=${cuentas}`, token).catch(() => null)
            : Promise.resolve(null),
        ]);
        const pm = r.porMoneda[0];
        setFlujo(pm ? { ingresos: pm.ingresos, gastos: pm.gastos, moneda: pm.moneda } : null);
        setMovsMes(r.movimientos);
        setAportesMes(r.aportes ?? []);
        const fm =
          f?.porMoneda.find((x) => x.moneda === preferencias.monedaPreferida) ??
          [...(f?.porMoneda ?? [])].sort((a, b) => Math.abs(b.tienes) - Math.abs(a.tienes))[0];
        if (fm) {
          const g = agruparFoto(fm.lineas);
          setFotoMes({ entro: g.entro, salio: g.salio, moneda: fm.moneda });
        } else {
          setFotoMes(null);
        }
      } catch {
        setFlujo(null);
        setMovsMes([]);
        setAportesMes([]);
        setFotoMes(null);
      }
      setCategorias(
        await api
          .get<CategoriaMovimientoDTO[]>(`/hogares/${activo}/categorias-movimiento`, token)
          .catch(() => []),
      );

      let objs: ObjetivoFinancieroDTO[] = [];
      try {
        objs = await api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token);
        setObjetivos(objs);
      } catch {
        setObjetivos([]);
      }

      try {
        const presus = await api.get<PresupuestoDTO[]>('/presupuestos', token);
        // L-12: el presupuesto del lente — INDIVIDUAL en "Lo mío"; FAMILIAR del hogar activo en "Del hogar".
        const vig = presus.find(
          (x) =>
            x.vigente &&
            x.estado !== 'CERRADO' &&
            (alcance === 'hogar' ? x.tipo === 'FAMILIAR' && x.hogarId === activo : x.tipo === 'INDIVIDUAL'),
        );
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
      setPorPagar(
        await api
          .get<SolicitudDTO[]>('/usuarios/me/solicitudes', token)
          .then((ss) => ss.filter((x) => x.direccion === 'RECIBIDA' && x.estado === 'PENDIENTE'))
          .catch(() => []),
      );
      const hoyISO = aISO(new Date());
      setPorConfirmar(
        await api
          .get<MovimientoProgramadoDTO[]>('/movimientos-programados', token)
          .then((ms) =>
            ms
              .filter((x) => x.estado === 'PENDIENTE' && x.fechaProgramada.slice(0, 10) <= hoyISO)
              .sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada)),
          )
          .catch(() => []),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, usuario.id, nav, claveHogar, claveOnb, alcance, setSoloUnMiembro, preferencias.mes, preferencias.monedaPreferida]);

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

  // Plantilla Resumen: las dos cifras bajo la principal la explican — Tienes
  // menos Debes da el total. Se muestran solo si cuadran exactamente.
  const tienesDebes = (() => {
    if (alcance === 'hogar') {
      const pm = consolidado?.porMoneda;
      if (!pm || pm.length !== 1 || hh?.tipo === 'error' || pm[0].moneda !== monedaPrin) return null;
      const debes = Math.abs(pm[0].pasivos);
      return Math.abs(pm[0].activos - debes - pm[0].patrimonioNeto) < 1
        ? { tienes: pm[0].activos, debes, moneda: pm[0].moneda }
        : null;
    }
    if (!principal) return null;
    let tienes = 0;
    let debes = 0;
    for (const e of elementos) {
      if (e.moneda !== principal.moneda || e.estado === 'INACTIVO') continue;
      const pct = (e.propietarios.find((p) => p.usuarioId === usuario.id)?.porcentaje ?? 100) / 100;
      const valor = e.valorVigente * pct;
      if (valor < 0) debes += -valor;
      else tienes += valor;
    }
    return Math.abs(tienes - debes - principal.patrimonio) < 1 ? { tienes, debes, moneda: principal.moneda } : null;
  })();
  const puntos = principal
    ? (serie?.puntos ?? []).map((pt) => pt.porMoneda.find((m) => m.moneda === principal.moneda)?.patrimonio ?? 0)
    : [];

  // ── Composición ────────────────────────────────────────────────────────
  const composicion: { cat: (typeof CATS)[number]; valor: number; sub: string }[] = [];
  if (alcance === 'hogar' && metricasHogar) {
    const m = metricasHogar;
    const act = new Map(m.distribucionPorActivo.map((d) => [d.categoria, d]));
    const pas = new Map(m.distribucionPorPasivo.map((d) => [d.categoria, d]));
    for (const cat of CATS) {
      const d = act.get(cat) ?? pas.get(cat);
      if (d) composicion.push({ cat, valor: d.valor, sub: `${Math.round(d.porcentaje)}% del total` });
    }
  } else {
    for (const cat of CATS) {
      const delCat = elementos.filter((e) => e.categoriaFuncional === cat);
      if (delCat.length === 0) continue;
      // Tu parte de cada cuenta o bien, como la cifra de arriba.
      const valor = delCat
        .filter((e) => e.moneda === monedaPrin && e.estado !== 'INACTIVO')
        .reduce(
          (s, e) => s + (e.valorVigente * (e.propietarios.find((p) => p.usuarioId === usuario.id)?.porcentaje ?? 100)) / 100,
          0,
        );
      composicion.push({ cat, valor, sub: `${delCat.length} ${delCat.length === 1 ? 'elemento' : 'elementos'}` });
    }
  }

  // ── Objetivos ──────────────────────────────────────────────────────────
  // L-12: en "Lo mío", solo las metas personales; en "Del hogar", las del hogar activo.
  const enProgreso = objetivos.filter(
    (o) => o.estado === 'EN_PROGRESO' && (alcance === 'mios' ? o.hogarId === null : o.hogarId === hogarId),
  );

  /** G39 (F-3): "✅ Sí": se anota con el monto y la fecha previstos, como "Sí, se pagó" del Programado. */
  const confirmarSi = async (m: MovimientoProgramadoDTO) => {
    setConfirmando(m.id);
    try {
      await api.post(
        '/comandos/MaterializarMovimientoProgramado',
        { movimientoId: m.id, fechaEfectiva: m.fechaProgramada.slice(0, 10) },
        token,
      );
      toast.mostrar(m.tipo === 'INGRESO' ? 'Listo, quedó anotado lo que llegó' : 'Listo, quedó anotado');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setConfirmando(null);
    }
  };

  // ── Alertas (máx 3, por prioridad) ─────────────────────────────────────
  const enMora = elementos.filter(
    (e) => e.estadoOperativo === 'EN_MORA' || e.estadoOperativo === 'INCOBRABLE',
  );
  // L-9: en "Del hogar" lo que te piden ya encabeza "Entre [miembro] y tú"; como alerta, solo en "Lo mío".
  const alertas: { texto: string; sub?: string; emoji: string; onPress: () => void; accesorio?: ReactNode }[] = (
    alcance === 'mios' ? porPagar : []
  ).map((x) => ({
    texto:
      x.motivo === 'GASTO_COMPARTIDO'
        ? `${x.solicitante.nombre} te pide tu parte: ${money(x.monto, x.moneda)}${x.glosa ? ` · ${x.glosa}` : ''}`
        : `${x.solicitante.nombre} te pide anotar una transferencia de ${money(x.monto, x.moneda)}`,
    emoji: '🤝',
    onPress: () => nav.go('PagarSolicitud', { solicitudId: x.id }),
  }));
  for (const m of porConfirmar) {
    const pregunta = m.tipo === 'INGRESO' ? '¿Te llegó' : m.tipo === 'GASTO' ? '¿Pagaste' : '¿Hiciste';
    alertas.push({
      texto: `${pregunta} ${tituloProgramado(m, categorias, elementos)}?`,
      sub: `${money(m.montoPlanificado, m.moneda)} · era el ${fechaCorta(m.fechaProgramada.slice(0, 10))}`,
      emoji: '⏰',
      onPress: () => nav.go('MovimientoProgramadoDetalle', { movimientoId: m.id }),
      accesorio: (
        <Pastilla
          label={confirmando === m.id ? '…' : '✅ Sí'}
          accessibilityLabel={`Sí, ${tituloProgramado(m, categorias, elementos)}`}
          onPress={() => confirmando === null && void confirmarSi(m)}
        />
      ),
    });
  }
  // G39 (F-19): bienes e inversiones que cambian de valor y no se actualizan hace más de un año.
  const haceUnAnio = aISO(new Date(Date.now() - 365 * 86_400_000));
  for (const e of elementos) {
    if (e.estado !== 'ACTIVO' || !e.admiteValorizacion || e.valorOculto) continue;
    if (!['ACTIVO', 'INVERSION'].includes(e.categoriaFuncional)) continue;
    const ultima = e.fechaUltimaValorizacion ?? e.fechaAlta;
    if (!ultima || ultima > haceUnAnio) continue;
    const anios = Math.max(1, Math.floor((Date.now() - new Date(`${ultima}T00:00:00`).getTime()) / (365 * 86_400_000)));
    alertas.push({
      texto: `¿Cuánto vale hoy tu ${e.nombre}?`,
      sub: e.fechaUltimaValorizacion
        ? `Lo actualizaste hace ${anios === 1 ? '1 año' : `${anios} años`}`
        : `No lo actualizas desde que lo agregaste`,
      emoji: '📈',
      onPress: () =>
        nav.go('Valorizar', { elementoId: e.id, valorActual: e.valorVigente, moneda: e.moneda, contexto: e.nombre }),
    });
  }
  if (enMora.length > 0)
    alertas.push({
      texto: `${enMora.length} ${enMora.length === 1 ? 'deuda' : 'deudas'} en mora`,
      emoji: '⏰',
      onPress: () => nav.go('ElementoDetalle', { elementoId: enMora[0].id }),
    });
  if (presuExcedido)
    alertas.push({
      texto: `Te pasaste del presupuesto de ${MESES[hoy.getMonth()]}`,
      emoji: '📊',
      onPress: () => nav.go('PresupuestoDetalle', { presupuestoId: presuExcedido.id }),
    });
  // Los avisos sin leer ya los cuenta la campana: acá solo lo que pide algo.

  // G32 H-03/H-08 — una sola entrada a "Mi patrimonio" (todas las cuentas y bienes + evolución).
  const verPatrimonio = () => nav.go('PatrimonioSeccion', { alcance, moneda: monedaPrin, hogarId });

  const cerrarOnboarding = () => {
    setOnbOculto(true);
    void guardar(claveOnb, 'ok');
  };

  // ── G35: tarjetas de cuenta (Lo mío) ───────────────────────────────────
  const tarjetas = cuentasParaTarjetas(elementos, usuario.id);
  const emojis = preferencias.emojis;
  const metasTop = [...enProgreso].sort((a, b) => b.progresoPorcentaje - a.progresoPorcentaje).slice(0, 2);
  // G39 (claridad): lo que pasaste o te pasaron personas del hogar también cuenta en el mes.
  // G41: en "Lo mío", entró y salió de tus cuentas del día a día (los mismos de
  // Movimientos); en "Del hogar", lo que entró y gastaron (G39).
  const enFoto = alcance === 'mios' && fotoMes !== null;
  const monedaMes = enFoto ? fotoMes.moneda : (flujo?.moneda ?? monedaPrin);
  const pases = alcance === 'mios' ? pasesConPersonas(movsMes, monedaMes) : aportesComoPases(aportesMes, monedaMes);
  const balance = enFoto ? fotoMes.entro - fotoMes.salio : quedaDelMes(flujo?.ingresos ?? 0, flujo?.gastos ?? 0, pases);
  // L2 (S04): en "Del hogar", lo que entró al hogar y salió de él va en líneas
  // propias de la tarjeta (H2), no dentro de Entró / Salió; en "Lo mío", como antes.
  const lineasHogar = alcance === 'hogar' ? pases : [];
  const pasesEnBarra = alcance === 'hogar' ? [] : pases;
  const entro = enFoto ? fotoMes.entro : (flujo?.ingresos ?? 0) + pasesEnBarra.filter((p) => p.monto > 0).reduce((s, p) => s + p.monto, 0);
  const salio = enFoto ? fotoMes.salio : (flujo?.gastos ?? 0) - pasesEnBarra.filter((p) => p.monto < 0).reduce((s, p) => s + p.monto, 0);
  const pctSalio = entro > 0 ? Math.min(1, salio / entro) : salio > 0 ? 1 : 0;
  const ciclo = cicloDeAlcance(alcance, hogar, preferencias.mes);
  const mesHoy = cicloDe(hoy, ciclo);
  const ventanaMes = ventanaCiclo(mesHoy.anio, mesHoy.mes, ciclo);
  const rotuloMes = rotuloCiclo(mesHoy.anio, mesHoy.mes, ciclo);
  const mesNombre = MESES_LARGO[mesHoy.mes].charAt(0).toUpperCase() + MESES_LARGO[mesHoy.mes].slice(1);
  const nombre = usuario.nombre.split(' ')[0];
  // L1 (S04): en "Del hogar", el atajo "Transferirle a [miembro]" reemplaza a "Tu plata"
  // (va a su primera cuenta para transferir); con más de un miembro, abre Moví plata.
  const otroUnico = entre?.otros.length === 1 ? entre.otros[0] : null;
  const atajoPlata =
    alcance === 'hogar'
      ? {
          icon: 'swap-horizontal-outline' as const,
          label: otroUnico ? `Transferirle a ${otroUnico.nombre}` : 'Moví plata',
          onPress: () =>
            nav.go(
              'RegistrarMovimiento',
              otroUnico && paraTransferir[0]
                ? { tipo: 'TRANSFERENCIA', destinoId: paraTransferir[0].id }
                : { tipo: 'TRANSFERENCIA' },
            ),
        }
      : { icon: 'wallet-outline' as const, label: 'Tu plata', onPress: verPatrimonio };

  return (
    <Screen
      onRefresh={cargar}
      fab={
        <FabMenu titulo={TITULO_ANOTAR} actions={anotar.acciones} />
      }
    >
      <TopRow
        left={
          <View>
            <Text style={styles.fecha}>{fechaLarga(hoy)}</Text>
            <Text style={styles.hola}>Hola, {nombre}</Text>
          </View>
        }
        right={
          <>
            <IconButton
              icon="notifications-outline"
              badge={noLeidas || undefined}
              accessibilityLabel="Avisos"
              onPress={() => nav.go('Notificaciones')}
            />
            <IconButton icon="settings-outline" accessibilityLabel="Ajustes" onPress={() => nav.go('Ajustes')} />
          </>
        }
      />
      {lente ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <PillToggle
            options={['mios', 'hogar'] as const}
            value={alcance}
            onChange={setAlcance}
            format={(x) => (x === 'mios' ? 'Lo mío' : 'Del hogar')}
          />
        </View>
      ) : (
        // L-4: solo en el hogar, en el lugar del lente, invitar a quien vive contigo.
        <MenuList
          items={[
            {
              title: 'Invita a quien vive contigo',
              subtitle: 'Le llega un correo para unirse a tu hogar',
              emoji: '👥',
              onPress: () => invitarAlHogar(nav, hogar.id),
            },
          ]}
        />
      )}
      {alertas.length > 0 && (
        <ListCard>
          {alertas.slice(0, 3).map((a, i) => (
            <TxRow key={i} title={a.texto} subtitle={a.sub} amount="" logo={{ emoji: a.emoji }} onPress={a.onPress} accesorio={a.accesorio} />
          ))}
          {alertas.length > 3 && (
            <TxRow title={`Ver todos los avisos (${alertas.length})`} amount="" logo={{ emoji: '🔔' }} onPress={() => nav.go('Notificaciones')} />
          )}
        </ListCard>
      )}
      {/* L1 (S04): "Entre [miembro] y tú", debajo de las alertas; lo pendiente va arriba. */}
      {alcance === 'hogar' && entre && entre.otros.length > 0 && entre.filas.length > 0 && (
        <Section
          title={`🤝 ${entre.titulo}`}
          accion={`Ver todo (${entre.filas.length})`}
          onAccion={() => nav.go('EntreMiembros', { hogarId })}
        >
          <ListCard>
            {entre.filas.slice(0, 4).map((f) => (
              <FilaEntreRow key={f.key} f={f} />
            ))}
          </ListCard>
        </Section>
      )}
      {/* L-5/L-6 (S04): primero el mes — "Te queda de [mes]" es la cifra principal. */}
      {ver.flujo && (
        <Pressable
          onPress={() => nav.go('Movimientos')}
          accessibilityRole="button"
          accessibilityLabel={`${mesNombre}: ${balance >= 0 ? `${alcance === 'hogar' ? 'les' : 'te'} queda ${money(balance, monedaMes)}` : `salió ${money(-balance, monedaMes)} más de lo que entró`}. Ver movimientos`}
          style={({ pressed }) => [styles.mes, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.headRow}>
            <Text style={styles.mesTitulo}>
              {`📅 ${mesNombre}`}
              {rotuloMes ? <Text style={styles.muted}>{`  ${rotuloMes}`}</Text> : null}
            </Text>
            <Text style={styles.mesFlecha}>›</Text>
          </View>
          {entro === 0 && salio === 0 && lineasHogar.length === 0 ? (
            <Text style={styles.muted}>Todavía no entra ni sale nada este mes.</Text>
          ) : (
            <>
              {/* G41: lo que queda de lo que entró este mes (lo de meses anteriores va en Tu plata, aparte). */}
              <Text style={styles.mesQueda}>
                {balance >= 0 ? `🧮 ${alcance === 'hogar' ? 'Les' : 'Te'} queda de ${MESES_LARGO[mesHoy.mes]}` : '⚠️ Salió más de lo que entró'}
              </Text>
              <Text style={[styles.mesCifra, { color: balance >= 0 ? c.text : c.danger }]}>
                {money(Math.abs(balance), monedaMes)}
              </Text>
              <View style={[styles.mesBarra, { backgroundColor: tinte(c.ok, 0.25) }]}>
                <View style={[styles.mesBarraSalio, { width: `${pctSalio * 100}%`, backgroundColor: c.danger }]} />
              </View>
              <View style={styles.headRow}>
                {/* La barra es lo que entró; la parte llena, lo que ya salió (rojo, como en Movimientos). */}
                <Text style={[styles.mesDato, { color: c.danger }]}>{`📤 Salió ${money(salio, monedaMes)}`}</Text>
                <Text style={[styles.mesDato, { color: c.ok }]}>{`📥 Entró ${money(entro, monedaMes)}`}</Text>
              </View>
              {/* H2: en "Del hogar", lo que entró al hogar y salió de él, por persona (entra en "Les queda"). */}
              {lineasHogar.map((p) => (
                <View key={`${p.usuarioId}${p.monto < 0 ? '-' : '+'}`} style={styles.headRow}>
                  <Text style={[styles.mesDato, { color: c.text }]}>{p.monto < 0 ? `🚪 Salió del hogar · ${p.nombre}` : `🏠 Entró al hogar · ${p.nombre}`}</Text>
                  <Text style={[styles.mesDato, { color: p.monto < 0 ? c.danger : c.ok }]}>
                    {`${p.monto < 0 ? '−' : '+'} ${money(Math.abs(p.monto), monedaMes)}`}
                  </Text>
                </View>
              ))}
            </>
          )}
        </Pressable>
      )}
      <Pressable
        onPress={verPatrimonio}
        accessibilityRole="button"
        accessibilityLabel="Ver dónde está tu plata"
      >
        <Hero
          label={alcance === 'hogar' ? '🏦 Plata del hogar' : '🏦 Tu plata hoy'}
          ver
          value={heroValor}
          change={
            alcance === 'mios' && v && v.variacion !== 0
              ? `${v.variacion >= 0 ? '▲' : '▼'} ${
                  v.variacionPorcentaje != null
                    ? `${String(Math.abs(v.variacionPorcentaje)).replace('.', ',')}%`
                    : money(Math.abs(v.variacion), monedaPrin)
                }`
              : undefined
          }
          changeDir={v && v.variacion < 0 ? 'neg' : 'pos'}
          substats={
            tienesDebes
              ? [
                  { label: alcance === 'hogar' ? '💰 Tienen' : '💰 Tienes', value: money(tienesDebes.tienes, tienesDebes.moneda) },
                  { label: alcance === 'hogar' ? '💳 Deben' : '💳 Debes', value: money(tienesDebes.debes, tienesDebes.moneda) },
                ]
              : undefined
          }
        >
          {alcance === 'mios' && puntos.length >= 2 ? <Sparkline valores={puntos} alto={44} color={c.primary} /> : null}
        </Hero>
      </Pressable>
      {hh?.tipo === 'error' && <ErrorText>{hh.mensaje}</ErrorText>}
      {hh?.tipo === 'parcial' && (
        <ErrorText>{`Este total no incluye la plata en ${hh.faltantes.join(', ')}: falta su valor en ${hh.moneda}.`}</ErrorText>
      )}
      {!onbOculto && (
        <Panel>
          <View style={styles.headRow}>
            <Text style={styles.section}>Primeros pasos</Text>
            <Pressable hitSlop={8} onPress={cerrarOnboarding} accessibilityRole="button" accessibilityLabel="Ocultar primeros pasos">
              <Text style={styles.muted}>Ocultar</Text>
            </Pressable>
          </View>
          <Paso hecho={pasos.cuenta} texto="Agrega tu primera cuenta" onPress={() => nav.go('AgregarElemento')} c={c} styles={styles} />
          <Paso hecho={pasos.movimiento} texto="Anota un gasto o un ingreso" onPress={anotar.abrir} c={c} styles={styles} />
          <Paso hecho={pasos.objetivo} texto="Crea una meta" onPress={() => nav.go('MetaForm')} c={c} styles={styles} />
          <Text style={styles.muted}>
            Abajo tienes 3 secciones: Inicio (cuánto tienes), Movimientos (lo que entra y
            sale) y Planificar (metas, presupuesto y pagos futuros).
            {/* L-11: la frase del lente, solo si hay lente. */}
            {lente ? ' Arriba eliges si ves lo tuyo o lo del hogar.' : ''}
          </Text>
        </Panel>
      )}
      {hogares.length > 1 && (
        <Elegir
          label="¿Qué hogar quieres ver?"
          value={hogarId}
          options={hogares.map((h) => ({ value: h.id, label: h.nombre }))}
          onChange={(id) => id && elegirHogar(id)}
        />
      )}
      {ver.composicion && alcance === 'mios' && (
        // "Ver todas" es el enlace de la sección, a la altura del título: un solo camino.
        <Section
          title="Tus cuentas"
          accion={tarjetas.length > MAX_TARJETAS ? `Ver todas (${tarjetas.length})` : 'Ver todas'}
          onAccion={tarjetas.length > 0 ? verPatrimonio : undefined}
        >
          {tarjetas.length === 0 ? (
            <EmptyState
              icon="wallet-outline"
              titulo="Aún no tienes cuentas"
              descripcion="Agrega tu cuenta, tarjeta, inversión o deuda para empezar."
              accion="Agregar mi primera cuenta"
              onAccion={() => nav.go('AgregarElemento')}
            />
          ) : (
            <CuentasYMovimientos
              tarjetas={tarjetas}
              emojis={emojis.elementos}
              movsMes={movsMes}
              categorias={categorias}
              mes={MESES_LARGO[mesHoy.mes]}
              ventana={ventanaMes}
            />
          )}
        </Section>
      )}
      {ver.composicion && alcance === 'hogar' && (
        <Section title="Dónde está la plata del hogar" accion="Ver todo" onAccion={composicion.length > 0 ? verPatrimonio : undefined}>
          {composicion.length === 0 ? (
            <Panel>
              <Text style={styles.muted}>Todavía no hay cuentas que sumen al hogar.</Text>
            </Panel>
          ) : (
            <ListCard>
              {composicion.slice(0, 4).map((x) => (
                <TxRow
                  key={x.cat}
                  title={NOMBRE_CATEGORIA_FUNCIONAL[x.cat]}
                  subtitle={x.sub}
                  amount={money(Math.abs(x.valor), monedaPrin)}
                  negativo={x.valor < 0}
                  logo={{ emoji: EMOJI_CATEGORIA_FUNCIONAL[x.cat] }}
                  onPress={() => nav.go('PatrimonioSeccion', { categoria: x.cat, alcance, moneda: monedaPrin, hogarId })}
                />
              ))}
            </ListCard>
          )}
        </Section>
      )}
      {ver.objetivos && metasTop.length > 0 && (
        <Section
          title={alcance === 'hogar' ? 'Metas del hogar' : 'Tus metas'}
          accion={enProgreso.length > 2 ? `Ver todas (${enProgreso.length})` : 'Ver todas'}
          onAccion={() => nav.go('Objetivos')}
        >
          <View style={styles.metas}>
            {metasTop.map((o) => (
              <Pressable
                key={o.id}
                style={({ pressed }) => [styles.meta, pressed && { opacity: 0.7 }]}
                onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
                accessibilityRole="button"
                accessibilityLabel={`${o.nombre}: ${Math.round(o.progresoPorcentaje)}%`}
              >
                <AnilloAvance pct={o.progresoPorcentaje}>
                  <Text style={styles.metaEmoji}>{emojiMeta(o.id, emojis.metas)}</Text>
                </AnilloAvance>
                <Text style={styles.metaNombre} numberOfLines={2}>
                  {o.nombre}
                </Text>
                <Text style={styles.metaSub}>
                  <Text style={styles.metaPct}>{Math.round(o.progresoPorcentaje)}%</Text>
                  {o.montoObjetivo > o.progreso ? ` · faltan ${money(o.montoObjetivo - o.progreso, o.moneda)}` : ' · ¡lista!'}
                </Text>
              </Pressable>
            ))}
            {metasTop.length === 1 ? <View style={styles.metaVacia} /> : null}
          </View>
        </Section>
      )}
      {ver.accesos && (
        <Section title="Atajos">
          <QuickActions
            items={[
              { icon: 'add-circle-outline', label: 'Anotar', onPress: anotar.abrir },
              { icon: 'flag-outline', label: 'Metas', onPress: () => nav.go('Objetivos') },
              { icon: 'calendar-outline', label: 'Programados', onPress: () => nav.go('MovimientosProgramados') },
              atajoPlata,
            ]}
          />
        </Section>
      )}
      <ErrorText>{error}</ErrorText>
      {anotar.hoja}
    </Screen>
  );
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fechaLarga = (d: Date) => {
  const t = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Orden de las tarjetas: primero lo del día a día (cuentas y tarjetas), después lo demás. */
const ORDEN_TARJETA = ['LIQUIDEZ', 'DEUDA', 'CREDITO', 'INVERSION', 'RESERVA', 'ACTIVO'];

type Tarjeta = { el: ElementoPatrimonialDTO; valor: number };

/** Cuentas activas con tu parte del valor, en el orden de las tarjetas. */
function cuentasParaTarjetas(elementos: ElementoPatrimonialDTO[], usuarioId: string): Tarjeta[] {
  return elementos
    .filter((e) => e.estado !== 'INACTIVO')
    .map((el) => ({
      el,
      valor: (el.valorVigente * (el.propietarios.find((p) => p.usuarioId === usuarioId)?.porcentaje ?? 100)) / 100,
    }))
    .sort(
      (a, b) =>
        ORDEN_TARJETA.indexOf(a.el.categoriaFuncional) - ORDEN_TARJETA.indexOf(b.el.categoriaFuncional) ||
        Math.abs(b.valor) - Math.abs(a.valor),
    );
}


const MAX_TARJETAS = 3;
const MAX_MOVIMIENTOS = 4;

/**
 * G35: las cuentas como tarjetas de color (3; "Ver todas" es el enlace de la sección) y, debajo, los
 * movimientos del mes de la que está elegida, con un interruptor para ver los
 * de todas tus cuentas. Solo 4 filas: el resto vive en la pestaña Movimientos.
 */
function CuentasYMovimientos({
  tarjetas,
  emojis,
  movsMes,
  categorias,
  mes,
  ventana,
}: {
  tarjetas: Tarjeta[];
  emojis: Record<string, string>;
  movsMes: MovimientoReporteDTO[];
  categorias: CategoriaMovimientoDTO[];
  mes: string;
  /** G43: el mes según el día en que parte. */
  ventana: { desde: string; hasta: string };
}) {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const nav = useNav();
  const { token } = useSession();
  const visibles = tarjetas.slice(0, MAX_TARJETAS);
  const [selId, setSelId] = useState(visibles[0].el.id);
  const [soloCuenta, setSoloCuenta] = useState(true);
  const [eventos, setEventos] = useState<EventoFinancieroDTO[] | null>(null);
  const sel = visibles.find((t) => t.el.id === selId) ?? visibles[0];

  useEffect(() => {
    if (!soloCuenta) return;
    let vivo = true;
    setEventos(null);
    api
      .get<EventoFinancieroDTO[]>(`/eventos-financieros?elemento=${sel.el.id}`, token)
      .then((evs) => vivo && setEventos(evs))
      .catch(() => vivo && setEventos([]));
    return () => {
      vivo = false;
    };
  }, [sel.el.id, soloCuenta, token]);

  const catPorId = new Map(categorias.map((x) => [x.id, x]));
  const emojiDe = (categoriaId: string | null, tipo: string) =>
    emojiCategoria(categoriaId ? catPorId.get(categoriaId) : null) ?? emojiTipoMovimiento(tipo);
  const subDe = (categoriaId: string | null, tipo: string, fecha: string) =>
    `${fechaLegible(fecha)} · ${categoriaId ? (catPorId.get(categoriaId)?.nombre ?? etiqueta(tipo)) : etiqueta(tipo)}`;

  const delMes = (f: string) => f.slice(0, 10) >= ventana.desde && f.slice(0, 10) <= ventana.hasta;

  let filas: { id: string; titulo: string; sub: string; emoji: string; monto: number; moneda: string }[] = [];
  if (soloCuenta) {
    // Como en el detalle de la cuenta: la corrección se junta con su original.
    const evs = eventos ?? [];
    const correccionDe = new Map(evs.filter((e) => e.correccionDeId).map((e) => [e.correccionDeId as string, e]));
    filas = evs
      .filter((e) => !e.correccionDeId && !e.anulado && delMes(e.fecha))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, MAX_MOVIMIENTOS)
      .map((e) => {
        const corr = correccionDe.get(e.id);
        const monto =
          (e.impactos.find((i) => i.elementoId === sel.el.id)?.monto ?? e.monto) +
          (corr?.impactos.find((i) => i.elementoId === sel.el.id)?.monto ?? 0);
        return {
          id: e.id,
          titulo: e.glosa || etiqueta(e.tipo),
          sub: subDe(e.categoriaId, e.tipo, e.fecha),
          emoji: emojiDe(e.categoriaId, e.tipo),
          monto,
          moneda: e.moneda,
        };
      });
  } else {
    filas = [...movsMes]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, MAX_MOVIMIENTOS)
      .map((m) => ({
        id: m.eventoId,
        titulo: m.glosa || etiqueta(m.tipo),
        sub: subDe(m.categoriaId, m.tipo, m.fecha),
        emoji: emojiDe(m.categoriaId, m.tipo),
        monto: m.tipo === 'GASTO' ? -m.monto : m.tipo === 'INGRESO' || m.tipo === 'SALDO_INICIAL' ? m.monto : (m.efectoPropio ?? 0),
        moneda: m.moneda,
      }));
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carrusel} contentContainerStyle={styles.carruselFila}>
        {visibles.map((t, i) => {
          const on = t.el.id === sel.el.id;
          return (
            <Pressable
              key={t.el.id}
              onPress={() => {
                setSelId(t.el.id);
                setSoloCuenta(true);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.el.nombre}: ${money(t.valor, t.el.moneda)}. Ver sus movimientos`}
              style={[
                styles.tarjeta,
                // Por posición: tarjetas vecinas nunca repiten color.
                { backgroundColor: c.tarjetas[i % c.tarjetas.length] },
                on ? { borderColor: c.primary } : { opacity: 0.6 },
              ]}
            >
              <View style={styles.tarjetaCirculo} />
              <Text style={styles.tarjetaEmoji}>{emojiElemento(t.el, emojis)}</Text>
              <Text style={styles.tarjetaNombre} numberOfLines={1}>
                {t.el.nombre}
              </Text>
              <Text style={styles.tarjetaValor} numberOfLines={1}>
                {money(t.valor, t.el.moneda)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ListCard>
        <View style={styles.swFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.swTitulo} numberOfLines={1}>
              {soloCuenta ? `Solo ${sel.el.nombre}` : 'Todas tus cuentas'} · {mes}
            </Text>
            {soloCuenta ? (
              <Pressable
                onPress={() => nav.go('ElementoDetalle', { elementoId: sel.el.id })}
                accessibilityRole="button"
                style={styles.zonaEnlace}
              >
                <Text style={styles.swLink}>Ver la cuenta</Text>
              </Pressable>
            ) : null}
          </View>
          {/* El interruptor solo es chico: se toca en un área de 44 px o más a su alrededor. */}
          <Pressable
            onPress={() => setSoloCuenta((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: soloCuenta }}
            accessibilityLabel="Ver solo los movimientos de la cuenta elegida"
            style={styles.zonaSwitch}
          >
            <View pointerEvents="none">
              <Switch
                value={soloCuenta}
                trackColor={{ true: c.primary, false: c.faint }}
                thumbColor="#ffffff"
                ios_backgroundColor={c.faint}
                {...thumbWeb(c)}
              />
            </View>
          </Pressable>
        </View>
        {soloCuenta && eventos === null ? (
          <Text style={styles.swVacio}>Cargando…</Text>
        ) : filas.length === 0 ? (
          <Text style={styles.swVacio}>Sin movimientos este mes.</Text>
        ) : (
          filas.map((f) => (
            <TxRow
              key={f.id}
              title={f.titulo}
              subtitle={f.sub}
              amount={`${f.monto < 0 ? '−' : f.monto > 0 ? '+' : ''}${money(Math.abs(f.monto), f.moneda)}`}
              positivo={f.monto > 0}
              logo={{ emoji: f.emoji }}
              onPress={() => nav.go('MovimientoDetalle', { eventoId: f.id })}
            />
          ))
        )}
        <Pressable onPress={() => nav.irATab('Movimientos')} accessibilityRole="button" style={styles.verMovs}>
          <Text style={styles.swLink}>Ver todos los movimientos</Text>
        </Pressable>
      </ListCard>
    </>
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
      <Text style={{ fontSize: 15 }}>{hecho ? '✅' : '⬜'}</Text>
      <Text style={[styles.pasoTxt, hecho && { color: c.mutedDim, textDecorationLine: 'line-through' }]}>{texto}</Text>
    </Pressable>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    section: tipoDe(c).seccion,
    muted: tipoDe(c).nota,
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fecha: { fontSize: 12, color: c.muted, fontWeight: '600' },
    hola: { fontSize: 20, color: c.text, fontWeight: '800' },
    balance: { fontSize: 14, fontWeight: '800' },
    mes: { ...panelDe(c), gap: 10 },
    mesTitulo: { fontSize: 16, fontWeight: '800', color: c.text },
    mesFlecha: { fontSize: 20, fontWeight: '700', color: c.primary },
    mesBarra: { height: 10, borderRadius: 5, overflow: 'hidden' },
    mesBarraSalio: { height: 10, borderRadius: 5 },
    mesDato: { fontSize: 13, fontWeight: '600' },
    mesQueda: { fontSize: 14, fontWeight: '700', color: c.muted },
    mesCifra: { ...tipografia.hero },
    paso: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    pasoTxt: { fontSize: 14, color: c.text },
    carrusel: { marginHorizontal: -16 },
    carruselFila: { paddingHorizontal: 16, paddingVertical: 4, gap: 10 },
    tarjeta: {
      width: 168,
      height: 108,
      borderRadius: 20,
      padding: 12,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    tarjetaCirculo: {
      position: 'absolute',
      right: -24,
      top: -24,
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    tarjetaEmoji: { fontSize: 22, marginBottom: 'auto' },
    tarjetaNombre: { fontSize: 13, color: '#fff', fontWeight: '600', opacity: 0.92 },
    tarjetaValor: { fontSize: 16, color: '#fff', fontWeight: '800' },
    swFila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    zonaSwitch: { padding: 12, margin: -12 },
    swTitulo: { fontSize: 14, fontWeight: '700', color: c.text },
    swLink: { fontSize: 13, fontWeight: '700', color: c.primary, marginTop: 2 },
    // 44 px de alto para el dedo sin mover el diseño.
    zonaEnlace: { alignSelf: 'flex-start', paddingVertical: 12, marginVertical: -12, paddingRight: 12 },
    swVacio: { fontSize: 13, color: c.muted, paddingVertical: 14 },
    verMovs: { alignItems: 'center', paddingVertical: 12 },
    metas: { flexDirection: 'row', gap: 12 },
    meta: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      padding: 14,
      borderRadius: 22,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
    },
    metaVacia: { flex: 1 },
    metaEmoji: { fontSize: 28 },
    metaNombre: { fontSize: 14, fontWeight: '700', color: c.text, textAlign: 'center' },
    metaSub: { fontSize: 12, color: c.muted, textAlign: 'center' },
    metaPct: { fontWeight: '800', color: c.text },
  });
