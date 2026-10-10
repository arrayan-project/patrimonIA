import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type EtiquetaDTO,
  type EventoFinancieroDTO,
  type HogarDTO,
  type ObjetivoFinancieroDTO,
  type PlantillaMovimientoDTO,
  type ReservaDeElementoDTO,
  type ResumenFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { money } from '../format';
import { EMOJI_ANOTAR, emojiCategoria, emojiMeta, emojiTipoMovimiento } from '../emojis';
import { usePreferencias } from '../preferencias';
import { opcionesDeElementos, opcionesDeMiembros } from '../opciones';
import {
  opcionesDePersonas,
  personasPrimero,
  saldoClaro,
  saldoResultante,
  saldoTexto,
  type PersonaDTO,
  type Previo,
  type ResultadoPlataDTO,
} from '../personas';
import { diaCorto, nombres, parteIgual, type SolicitudDTO, type TransferenciaHogarDTO } from '../solicitudes';
import { useToast } from '../ui/Toast';
import { Text } from '../ui/Text';
import { cadaCuando, siguienteFecha, type Periodicidad } from '../recurrencia';
import { categoriasMasUsadas, DIAS_RECIENTES, ultimaCuenta, type MovimientoReciente } from '../recientes';
import {
  colorAnotar,
  contadorPasos,
  Elegir,
  ElegirVarios,
  BloquePaso,
  aISO,
  Button,
  Cuando,
  ErrorText,
  etiqueta,
  Field,
  ListCard,
  MoneyField,
  MontoBanda,
  Nota,
  Opcionales,
  Pastilla,
  Question,
  Section,
  Skeleton,
  Screen,
  useC,
  TxRow,
} from '../ui';

const TIPOS = ['INGRESO', 'GASTO', 'TRANSFERENCIA', 'CONVERSION'] as const;
type Tipo = (typeof TIPOS)[number];

/** El título dice qué se está anotando (las puertas del menú `+`, D-8). */
const TITULOS: Record<Tipo, string> = {
  GASTO: 'Gasté',
  INGRESO: 'Recibí',
  TRANSFERENCIA: 'Moví plata',
  CONVERSION: 'Moví plata',
};

/** G35: el emoji de cada puerta del "+" (banda del monto y resumen). */
/** G35: los 2 primeros Frecuentes (orden de Ajustes › Frecuentes) van a un toque; el resto en "Ver todos". */
const FRECUENTES_A_LA_VISTA = 2;
/** "Tus frecuentes de …" / "Aún no tienes frecuentes de …". */
const DE_TIPO: Record<Tipo, string> = { GASTO: 'gasto', INGRESO: 'ingreso', TRANSFERENCIA: 'plata movida', CONVERSION: 'plata movida' };
const EMOJIS: Record<Tipo, string> = EMOJI_ANOTAR;

/**
 * D-8 — paso 2 de Gasté y Recibí: de quién es la plata. HOGAR es "Compartido
 * con el hogar" en Gasté (D-7) y "De alguien del hogar" en Recibí.
 */
type Quien = 'MIO' | 'OTRA' | 'HOGAR';
/** Cuentas donde se recibe una transferencia de un miembro (como en el backend). */
const RECIBEN = ['LIQUIDEZ', 'RESERVA'];
const NUEVA = '__nueva__';
/** G39 (F-4): cuántas personas van como botones en "¿De quién?". */
const PERSONAS_A_LA_VISTA = 4;
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** G39 (F-8): "¿Se repite?" en dos botones; sin elegir, no se repite. */
const REPITE_BOTONES: { value: Periodicidad; label: string }[] = [
  { value: 'MENSUAL', label: '🔁 Cada mes' },
  { value: 'ANUAL', label: '📆 Cada año' },
];
const DIA = 24 * 60 * 60 * 1000;

/** Plata de una meta (asignación) ahorrada en la cuenta de origen (HZ-13). */
type MetaEnCuenta = { asignacionId: string; objetivoId: string | null; nombre: string; monto: number };

/** Agrupa las reservas activas de una cuenta por asignación. */
function metasDeReservas(reservas: ReservaDeElementoDTO[]): MetaEnCuenta[] {
  const porAsg = new Map<string, MetaEnCuenta>();
  for (const r of reservas) {
    const m = porAsg.get(r.asignacionId);
    if (m) m.monto += r.monto;
    else
      porAsg.set(r.asignacionId, {
        asignacionId: r.asignacionId,
        objetivoId: r.objetivoId,
        nombre: r.objetivoNombre ?? r.asignacionNombre,
        monto: r.monto,
      });
  }
  const metas = [...porAsg.values()];
  // Si una meta tiene varias partes en la cuenta, se nombra también la parte.
  return metas.map((m) => {
    const asg = reservas.find((r) => r.asignacionId === m.asignacionId)!;
    const repetida = metas.filter((x) => x.objetivoId && x.objetivoId === m.objetivoId).length > 1;
    return repetida ? { ...m, nombre: `${m.nombre} · ${asg.asignacionNombre}` } : m;
  });
}

export function RegistrarMovimientoScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();
  const { preferencias } = usePreferencias();
  const emojis = preferencias.emojis;

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [elementosHogar, setElementosHogar] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaMovimientoDTO[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaDTO[]>([]);
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>([]);
  // G32 H-07 — se puede llegar con la cuenta (o el tipo) ya elegidos desde un elemento.
  const params = nav.route.params ?? {};
  const cuentaId = params.cuentaId as string | undefined;
  const [tipo, setTipo] = useState<Tipo>(
    TIPOS.includes(params.tipo as Tipo) ? (params.tipo as Tipo) : 'GASTO',
  );
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(aISO(new Date()));
  const origenInicial = (params.origenId as string | undefined) ?? cuentaId ?? null;
  const destinoInicial = (params.destinoId as string | undefined) ?? null;
  const [origenId, setOrigenId] = useState<string | null>(origenInicial);
  const [destinoId, setDestinoId] = useState<string | null>(destinoInicial);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const hogarId = hogar?.id ?? null;
  const [crearCat, setCrearCat] = useState(false);
  const [catNombre, setCatNombre] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [glosa, setGlosa] = useState('');
  // D-6: "¿Se repite?" deja programada la próxima vez, con aviso "¿Se pagó?".
  const [repite, setRepite] = useState<'NO' | Periodicidad>('NO');
  // El nombre del frecuente usado: sin detalle, nombra la repetición en la lista.
  const [frecuente, setFrecuente] = useState('');
  // HZ-13: gastar la plata de una meta. Se puede llegar con la meta ya elegida.
  const objetivoInicial = (params.objetivoId as string | undefined) ?? null;
  const [metasCuenta, setMetasCuenta] = useState<MetaEnCuenta[]>([]);
  const [asignacionId, setAsignacionId] = useState<string | null>(null);
  // D-8 / D-3: de quién es la plata y, si es de otra persona, de quién.
  const [quien, setQuien] = useState<Quien>('MIO');
  const [personas, setPersonas] = useState<PersonaDTO[]>([]);
  const [persona, setPersona] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  // HZ-20: si la persona no tenía saldo, ¿te había pasado plata antes?
  const [previo, setPrevio] = useState<Previo | null>(null);
  // G39 (F-14): "¿De dónde sale esta plata?" → "Es de [persona]" abre "¿La anotaste?".
  const [eraSuya, setEraSuya] = useState(false);
  const [ingresoId, setIngresoId] = useState<string | null>(null);
  // Movimientos de tus cuentas: los ingresos a corregir (HZ-20) y lo que te
  // transfirió alguien del hogar (D-8). Se cargan solo si hacen falta.
  const [eventosCuentas, setEventosCuentas] = useState<EventoFinancieroDTO[] | null>(null);
  const [transferenciasHogar, setTransferenciasHogar] = useState<TransferenciaHogarDTO[] | null>(null);
  // D-7: "Compartido con el hogar". `conQuienes` null = todos los miembros.
  const [reparto, setReparto] = useState<'MITAD' | 'OTRO'>('MITAD');
  const [parteOtro, setParteOtro] = useState('');
  const [conQuienes, setConQuienes] = useState<string[] | null>(null);
  const [recibeId, setRecibeId] = useState<string | null>(null);
  // G39 (F-11): en "Con [miembro]", si ya te pasó su parte no se le pide nada.
  const [yaPaso, setYaPaso] = useState(false);
  // G39 (F-9): en Moví plata, "¿A dónde va la plata?": 'MIA' o el usuario del miembro.
  const [hacia, setHacia] = useState<string | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  // Recibí → De alguien del hogar: "Avisarle a [miembro]" si la transferencia no aparece.
  const [avisarA, setAvisarA] = useState<string | null>(null);
  const [avisando, setAvisando] = useState(false);
  // G39 (F-1, F-2): los movimientos de los últimos días dicen la cuenta de la
  // última vez y las categorías más usadas. `recordado` es lo que se preeligió.
  const [recientes, setRecientes] = useState<MovimientoReciente[] | null>(null);
  const [recordado, setRecordado] = useState<{ origenId: string | null; destinoId: string | null } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useTitulo((params.titulo as string | undefined) ?? TITULOS[tipo]);
  // G35: la banda del monto lleva el color y el emoji de la puerta del "+".
  // G39 (F-5): "💳 Pagar una deuda" (del "+" o del detalle de una deuda).
  const esPago = params.pago === true || params.titulo === 'Pagar tarjeta';
  const c = useC();
  const colorBanda = colorAnotar(c, esPago ? 'TARJETA' : tipo);
  const emojiBanda = esPago ? '💳' : EMOJIS[tipo];

  const sucio =
    Number(monto) > 0 ||
    origenId !== (origenInicial ?? recordado?.origenId ?? null) ||
    destinoId !== (destinoInicial ?? recordado?.destinoId ?? null) ||
    glosa.trim() !== '' ||
    categoriaId !== null ||
    persona !== null ||
    etiquetaIds.length > 0;
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
      .then(setElementos)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token)
      .then(setElementosHogar)
      .catch(() => setElementosHogar([]));
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) => {
        setHogar(hs[0] ?? null);
        // La lista no trae los miembros; el detalle sí ("De alguien del hogar", D-8).
        if (hs[0]) {
          api
            .get<HogarDTO>(`/hogares/${hs[0].id}`, token)
            .then(setHogar)
            .catch(() => {});
        }
        return hs[0]
          ? api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hs[0].id}/categorias-movimiento`,
              token,
            )
          : [];
      })
      .then(setCategorias)
      .catch(() => setCategorias([]));
    api
      .get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token)
      .then(setEtiquetas)
      .catch(() => setEtiquetas([]));
    api
      .get<PersonaDTO[]>('/usuarios/me/personas?todas=true', token)
      .then(setPersonas)
      .catch(() => setPersonas([]));
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - DIAS_RECIENTES * DIA);
    api
      .get<ResumenFinancieroDTO>(`/usuarios/me/resumen-financiero?desde=${aISO(desde)}&hasta=${aISO(hoy)}&alcance=mios`, token)
      .then((r) => setRecientes(r.movimientos))
      .catch(() => setRecientes([]));
  }, [token]);

  // Los Frecuentes se recargan al volver (p. ej. de "Crear uno").
  const cargarPlantillas = useCallback(() => {
    api
      .get<PlantillaMovimientoDTO[]>('/usuarios/me/plantillas-movimiento', token)
      .then(setPlantillas)
      .catch(() => setPlantillas([]));
  }, [token]);
  useCargaAlEnfocar(cargarPlantillas);

  // Fuera de Gasté y Recibí no hay paso 2.
  useEffect(() => {
    if (tipo !== 'GASTO' && tipo !== 'INGRESO') setQuien('MIO');
  }, [tipo]);

  // D-8: los movimientos de una cuenta no dicen de quién es el otro lado; las
  // transferencias con miembros las arma el backend.
  const verDelHogar = (tipo === 'INGRESO' && quien === 'HOGAR') || (tipo === 'GASTO' && quien === 'HOGAR' && yaPaso);
  useEffect(() => {
    if (!verDelHogar || transferenciasHogar) return;
    api
      .get<TransferenciaHogarDTO[]>('/usuarios/me/transferencias-hogar?dias=30', token)
      .then(setTransferenciasHogar)
      .catch(() => setTransferenciasHogar([]));
  }, [verDelHogar, transferenciasHogar, token]);

  const necesitaEventos = previo === 'ANOTADA';
  useEffect(() => {
    if (!necesitaEventos || eventosCuentas || !elementos) return;
    const cuentas = elementos.filter(
      (e) => e.categoriaFuncional !== 'ACTIVO' && e.naturaleza !== 'CUSTODIA_INFORMAL',
    );
    Promise.all(
      cuentas.map((e) =>
        api.get<EventoFinancieroDTO[]>(`/eventos-financieros?elemento=${e.id}`, token).catch(() => []),
      ),
    )
      .then((listas) => {
        const porId = new Map(listas.flat().map((ev) => [ev.id, ev]));
        setEventosCuentas([...porId.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)));
      })
      .catch(() => setEventosCuentas([]));
  }, [necesitaEventos, eventosCuentas, elementos, token]);

  // HZ-13: las metas con plata en la cuenta de un gasto. Sin plata en metas, la
  // pregunta no aparece.
  useEffect(() => {
    if (tipo !== 'GASTO' || !origenId) {
      setMetasCuenta([]);
      setAsignacionId(null);
      return;
    }
    let vigente = true;
    api
      .get<ReservaDeElementoDTO[]>(`/elementos-patrimoniales/${origenId}/reservas`, token)
      .then((rs) => {
        if (!vigente) return;
        const metas = metasDeReservas(rs);
        setMetasCuenta(metas);
        setAsignacionId((actual) =>
          metas.some((m) => m.asignacionId === actual)
            ? actual
            : (metas.find((m) => objetivoInicial && m.objetivoId === objetivoInicial)?.asignacionId ?? null),
        );
      })
      .catch(() => vigente && (setMetasCuenta([]), setAsignacionId(null)));
    return () => {
      vigente = false;
    };
  }, [tipo, origenId, token, objetivoInicial]);

  // Sin selector de tipo (lo eligió la puerta del menú): en «Moví plata», si las
  // dos cuentas tienen monedas distintas, es un cambio de moneda.
  useEffect(() => {
    if (tipo !== 'TRANSFERENCIA' && tipo !== 'CONVERSION') return;
    const todos = [...(elementos ?? []), ...elementosHogar];
    const o = todos.find((e) => e.id === origenId);
    const d = todos.find((e) => e.id === destinoId);
    if (o && d) setTipo(o.moneda !== d.moneda ? 'CONVERSION' : 'TRANSFERENCIA');
  }, [tipo, origenId, destinoId, elementos, elementosHogar]);

  // Si la cuenta vino preelegida y el usuario cambia a Ingreso, la plata entra a esa cuenta.
  useEffect(() => {
    if (cuentaId && tipo === 'INGRESO') setDestinoId((d) => d ?? cuentaId);
  }, [cuentaId, tipo]);

  // G39 (F-5): las deudas que se pagan (no los encargos de otras personas) y
  // las cuentas con que se paga.
  const deudasPagables = useMemo(
    () =>
      (elementos ?? []).filter(
        (e) => e.categoriaFuncional === 'DEUDA' && e.naturaleza !== 'CUSTODIA_INFORMAL' && e.estado === 'ACTIVO',
      ),
    [elementos],
  );
  const pagaCon = (e: ElementoPatrimonialDTO) =>
    ['LIQUIDEZ', 'RESERVA', 'INVERSION'].includes(e.categoriaFuncional) && e.naturaleza !== 'CUSTODIA_INFORMAL';

  // G39 (F-1): si se entra sin cuenta elegida (por el "+"), viene la de la
  // última vez en esta puerta. Se ve como paso hecho y se cambia ahí mismo.
  const puerta = tipo === 'CONVERSION' ? 'TRANSFERENCIA' : tipo;
  useEffect(() => {
    if (recordado || !recientes || !elementos) return;
    // F-5: al pagar, la deuda y la cuenta de tu último pago (cada una solo si falta).
    if (esPago) {
      const cuentas = new Set(elementos.filter(pagaCon).map((e) => e.id));
      const deudas = new Set(deudasPagables.map((e) => e.id));
      const r = ultimaCuenta(recientes, 'TRANSFERENCIA', (id, lado) =>
        lado === 'origen' ? cuentas.has(id) : deudas.has(id),
      );
      const rec = {
        origenId: origenId ? null : (r?.origenId ?? null),
        destinoId: destinoId ? null : (r?.destinoId ?? null),
      };
      setRecordado(rec);
      if (rec.origenId) setOrigenId(rec.origenId);
      if (rec.destinoId) setDestinoId(rec.destinoId);
      return;
    }
    if (origenInicial || origenId || (destinoId && puerta !== 'TRANSFERENCIA')) {
      setRecordado({ origenId: null, destinoId: null });
      return;
    }
    // Moví plata recuerda solo plata entre cuentas: pagar una deuda o cobrar lo
    // que te deben tiene su propia puerta (💳 Pagar, 🤝 Me pagaron).
    const entreCuentas = (e: ElementoPatrimonialDTO) =>
      puerta !== 'TRANSFERENCIA' || ['LIQUIDEZ', 'RESERVA', 'INVERSION'].includes(e.categoriaFuncional);
    const propias = new Set(
      elementos.filter((e) => e.naturaleza !== 'CUSTODIA_INFORMAL' && entreCuentas(e)).map((e) => e.id),
    );
    const deMiembros = new Set(
      elementosHogar.filter((e) => !elementos.some((x) => x.id === e.id) && entreCuentas(e)).map((e) => e.id),
    );
    // F-10: con el destino ya elegido (Hogar › Para transferirles), solo falta la de salida.
    const r = destinoId
      ? {
          origenId:
            ultimaCuenta(recientes, puerta, (id, lado) => lado === 'destino' || (propias.has(id) && id !== destinoId))
              ?.origenId ?? null,
          destinoId: null,
        }
      : (ultimaCuenta(
          recientes,
          puerta,
          (id, lado) => propias.has(id) || (puerta === 'TRANSFERENCIA' && lado === 'destino' && deMiembros.has(id)),
        ) ?? { origenId: null, destinoId: null });
    setRecordado(r);
    if (r.origenId) setOrigenId(r.origenId);
    if (r.destinoId) setDestinoId(r.destinoId);
  }, [recordado, recientes, elementos, elementosHogar, esPago, deudasPagables, origenInicial, destinoInicial, origenId, destinoId, puerta]);

  const aplicarPlantilla = (p: PlantillaMovimientoDTO) => {
    if (p.tipo === 'INGRESO' || p.tipo === 'GASTO' || p.tipo === 'TRANSFERENCIA') setTipo(p.tipo);
    if (p.monto != null) setMonto(String(p.monto));
    if (p.elementoOrigenId) setOrigenId(p.elementoOrigenId);
    if (p.elementoDestinoId) setDestinoId(p.elementoDestinoId);
    setCategoriaId(p.categoriaId);
    setGlosa(p.glosa ?? '');
    setFrecuente(p.nombre);
  };

  // D-6: las plantillas son "Frecuentes": un toque llena el formulario. Solo las
  // de esta puerta (Gasté muestra las de gasto; Moví plata, las transferencias).
  const frecuentes = plantillas.filter(
    (p) =>
      p.tipo === (tipo === 'CONVERSION' ? 'TRANSFERENCIA' : tipo) &&
      // Al pagar, solo los frecuentes que pagan una deuda.
      (!esPago || deudasPagables.some((d) => d.id === p.elementoDestinoId)),
  );
  const emojiFrecuente = (p: PlantillaMovimientoDTO) =>
    emojiCategoria(categorias.find((x) => x.id === p.categoriaId)) ?? emojiTipoMovimiento(p.tipo);

  const necesitaOrigen = tipo === 'GASTO' || tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION';
  const necesitaDestino = tipo === 'INGRESO' || tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION';
  const puedeCategorizar = tipo === 'INGRESO' || tipo === 'GASTO';
  const categoriasAplicables = useMemo(() => {
    const aplica = (c: CategoriaMovimientoDTO) =>
      c.tipoAplicable === 'AMBOS' || c.tipoAplicable === tipo;
    const raices = categorias.filter((c) => !c.categoriaPadreId);
    const orden: CategoriaMovimientoDTO[] = [];
    for (const r of raices) {
      const hijos = categorias.filter((c) => c.categoriaPadreId === r.id && aplica(c));
      if (aplica(r) || hijos.length > 0) orden.push(r);
      orden.push(...hijos);
    }
    return orden;
  }, [categorias, tipo]);
  const preguntaCategoria = tipo === 'INGRESO' ? '¿De qué? (opcional)' : '¿En qué? (opcional)';
  const categoriaElegida = categorias.find((x) => x.id === categoriaId);
  const opcionesCategoria = [
    ...categoriasAplicables.map((x) => ({
      value: x.id,
      label: x.nombre,
      emoji: emojiCategoria(x) ?? '🏷️',
      sub: x.categoriaPadreId
        ? `Dentro de ${categorias.find((p) => p.id === x.categoriaPadreId)?.nombre ?? 'otra'}`
        : undefined,
    })),
    { value: NUEVA, label: 'Nueva categoría', emoji: '➕' },
  ];
  const elegirCategoria = (v: string | null) => (v === NUEVA ? setCrearCat(true) : setCategoriaId(v));
  // G39 (F-2): las categorías que más usa en esta puerta, a un toque.
  const masUsadas = useMemo(() => {
    if (!recientes || (tipo !== 'GASTO' && tipo !== 'INGRESO')) return [];
    const aplicables = new Map(categoriasAplicables.map((x) => [x.id, x]));
    return categoriasMasUsadas(recientes, tipo, (id) => aplicables.has(id)).map((id) => aplicables.get(id)!);
  }, [recientes, tipo, categoriasAplicables]);

  const crearCategoriaInline = async () => {
    if (!hogarId || !catNombre.trim()) return;
    setCatBusy(true);
    setError('');
    try {
      const nueva = await api.post<CategoriaMovimientoDTO>(
        '/comandos/CrearCategoriaMovimiento',
        { hogarId, nombre: catNombre.trim(), tipoAplicable: tipo },
        token,
      );
      const refrescadas = await api.get<CategoriaMovimientoDTO[]>(
        `/hogares/${hogarId}/categorias-movimiento`,
        token,
      );
      setCategorias(refrescadas);
      setCategoriaId(nueva.id);
      setCatNombre('');
      setCrearCat(false);
      toast.mostrar('Categoría creada');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setCatBusy(false);
    }
  };

  const monedaEvento = useMemo(() => {
    const ref = elementos?.find((e) => e.id === (necesitaOrigen ? origenId : destinoId));
    return ref?.moneda ?? 'CLP';
  }, [elementos, origenId, destinoId, necesitaOrigen]);

  const errMonto = Number(monto) > 0 ? '' : 'Ingresa un monto mayor a 0.';
  const errMismo =
    necesitaOrigen && necesitaDestino && origenId && origenId === destinoId
      ? 'La cuenta de salida y la de llegada no pueden ser la misma.'
      : '';

  // D-8: los otros miembros del hogar ("De alguien del hogar" solo si hay alguno).
  const otrosMiembros = (hogar?.miembros ?? []).filter((x) => x.usuarioId !== usuario?.id);
  const nombreMiembro = otrosMiembros.length === 1 ? otrosMiembros[0].nombre : 'alguien del hogar';
  const esOtra = puedeCategorizar && quien === 'OTRA';
  const direccion = tipo === 'GASTO' ? 'SALE' : 'ENTRA';
  const nombrePersona = (persona === NUEVA ? nuevoNombre : (persona ?? '')).trim().replace(/\s+/g, ' ');
  const opcionesP = opcionesDePersonas(personas, monedaEvento);
  const saldoActual =
    opcionesP.find((x) => x.nombre.toLocaleLowerCase('es') === nombrePersona.toLocaleLowerCase('es'))?.saldo ?? 0;
  const esMiembro = otrosMiembros.find(
    (x) => x.nombre.toLocaleLowerCase('es') === nombrePersona.toLocaleLowerCase('es'),
  );
  // HZ-20: solo con plata que sale por alguien sin saldo (o nuevo) hay ambigüedad.
  const pidePrevio = esOtra && tipo === 'GASTO' && !!nombrePersona && saldoActual === 0;
  const desde90 = Date.now() - 90 * DIA;
  const ingresosOpc = (eventosCuentas ?? []).filter(
    (ev) =>
      ev.tipo === 'INGRESO' && !ev.anulado && ev.moneda === monedaEvento && new Date(ev.fecha).getTime() >= desde90,
  );
  const ingreso = ingresosOpc.find((ev) => ev.id === ingresoId);

  const meta = tipo === 'GASTO' && !esOtra ? metasCuenta.find((m) => m.asignacionId === asignacionId) : undefined;
  const cuentaOrigen = elementos?.find((e) => e.id === origenId);

  // D-7: con quiénes se comparte, cuánto le toca a cada uno y dónde te lo transfieren.
  const esCompartido = tipo === 'GASTO' && quien === 'HOGAR';
  // D-6: se repite lo propio; la plata de otra persona, lo compartido y el cambio de moneda, no.
  const repiteAplica = !esOtra && !esCompartido && tipo !== 'CONVERSION';
  // G39 (F-8): con una fecha futura no se anota: queda programado para ese día.
  // Lo que el programado no sabe guardar (de otra persona, compartido, cambio
  // de moneda, plata de una meta) se anota el día que pasa.
  const esFuturo = fecha > aISO(new Date());
  const futuroNoSe = esFuturo && (!repiteAplica || !!asignacionId);
  const compartidoCon =
    otrosMiembros.length === 1
      ? otrosMiembros
      : otrosMiembros.filter((x) => (conQuienes ?? otrosMiembros.map((y) => y.usuarioId)).includes(x.usuarioId));
  const nombresCompartido = nombres(compartidoCon.map((x) => x.nombre));
  const parte =
    otrosMiembros.length === 1 && reparto === 'OTRO'
      ? Number(parteOtro) || 0
      : parteIgual(Number(monto) || 0, compartidoCon.length, monedaEvento);
  const errParte =
    !esCompartido || !(Number(monto) > 0)
      ? ''
      : compartidoCon.length === 0
        ? 'Elige con quién lo compartes.'
        : parte <= 0 || parte * compartidoCon.length > Number(monto)
          ? `Revisa cuánto le toca a ${nombresCompartido}.`
          : '';
  const cuentasRecibe = (elementos ?? []).filter(
    (e) => RECIBEN.includes(e.categoriaFuncional) && e.naturaleza !== 'CUSTODIA_INFORMAL' && e.moneda === monedaEvento,
  );
  // Viene elegida la cuenta del gasto si puede recibir plata.
  const recibe =
    cuentasRecibe.find((e) => e.id === recibeId) ?? cuentasRecibe.find((e) => e.id === origenId) ?? null;
  // D-2: en "Nada", los demás no ven la cuenta y no pueden transferirte.
  const oculta = (e: ElementoPatrimonialDTO | null | undefined) =>
    !!e && (e.visibilidadPorTipo?.EXISTENCIA ?? e.visibilidad) === 'PRIVADA';

  /** D-2: sube la cuenta a "Que puedan transferirte" sin tocar lo demás que comparte. */
  const dejarTransferir = async (elementoId: string) => {
    setCompartiendo(true);
    setError('');
    try {
      await api.post(
        '/comandos/DefinirVisibilidadElementoPatrimonial',
        { elementoId, niveles: { EXISTENCIA: 'FAMILIAR' } },
        token,
      );
      setElementos(await api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setCompartiendo(false);
    }
  };

  /** Recibí → De alguien del hogar: la transferencia no aparece y se le avisa al miembro. */
  const avisar = async (usuarioId: string, nombre: string) => {
    if (!destinoId) return;
    setAvisando(true);
    setError('');
    try {
      await api.comando<SolicitudDTO>(
        '/comandos/AvisarTransferenciaSinAnotar',
        { usuarioId, monto: Number(monto), cuentaDestinoId: destinoId, fecha },
        token,
        key,
      );
      toast.mostrar(`Le avisamos a ${nombre}`);
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setAvisando(false);
    }
  };

  /**
   * D-6: con "¿Se repite?", deja programada la próxima vez (el movimiento de hoy
   * ya quedó registrado). Devuelve lo que se agrega al aviso. Si falla, el
   * movimiento sigue registrado y se dice que no quedó programado.
   */
  const programarRepeticion = async (): Promise<string> => {
    if (!repiteAplica || repite === 'NO') return '';
    try {
      await api.post(
        '/comandos/CrearMovimientoProgramado',
        {
          tipo,
          montoPlanificado: Number(monto),
          moneda: monedaEvento,
          fechaProgramada: siguienteFecha(fecha, repite),
          ...(necesitaOrigen && origenId ? { elementoOrigenId: origenId } : {}),
          ...(necesitaDestino && destinoId ? { elementoDestinoId: destinoId } : {}),
          ...(puedeCategorizar && categoriaId ? { categoriaId } : {}),
          ...(glosa.trim() || frecuente ? { observaciones: glosa.trim() || frecuente } : {}),
          periodicidad: repite,
        },
        token,
      );
      return `. Te avisamos ${cadaCuando(repite, fecha)}`;
    } catch {
      return ', pero no se pudo dejar programada la repetición';
    }
  };

  const onSubmit = async () => {
    if (errMonto || errMismo || !puedeEnviar) return;
    setError('');
    setLoading(true);
    try {
      if (esFuturo) {
        await api.post(
          '/comandos/CrearMovimientoProgramado',
          {
            tipo,
            montoPlanificado: Number(monto),
            moneda: monedaEvento,
            fechaProgramada: fecha,
            ...(necesitaOrigen && origenId ? { elementoOrigenId: origenId } : {}),
            ...(necesitaDestino && destinoId ? { elementoDestinoId: destinoId } : {}),
            ...(puedeCategorizar && categoriaId ? { categoriaId } : {}),
            ...(glosa.trim() || frecuente ? { observaciones: glosa.trim() || frecuente } : {}),
            ...(repite !== 'NO' ? { periodicidad: repite } : {}),
          },
          token,
        );
        toast.mostrar(`Programado para el ${diaCorto(fecha)}`);
        permitirSalida();
        nav.back();
        return;
      }
      if (esOtra) {
        const r = await api.comando<ResultadoPlataDTO>(
          '/comandos/RegistrarPlataDeOtraPersona',
          {
            direccion,
            cuentaId: direccion === 'SALE' ? origenId : destinoId,
            monto: Number(monto),
            persona: nombrePersona,
            fecha,
            ...(glosa.trim() ? { glosa: glosa.trim() } : {}),
            ...(pidePrevio && previo === 'ANOTADA' && ingresoId ? { anularIngresoId: ingresoId } : {}),
            ...(pidePrevio && previo === 'NO_ANOTADA' ? { registrarEntrada: true } : {}),
          },
          token,
          key,
        );
        toast.mostrar(
          `${saldoTexto(r.persona, r.saldo, r.moneda, money)}${r.anuladoId ? '. Corregimos el ingreso' : ''}`,
        );
        permitirSalida();
        nav.back();
        return;
      }
      if (esCompartido && !yaPaso && recibe) {
        await api.comando(
          '/comandos/RegistrarGastoCompartido',
          {
            monto: Number(monto),
            moneda: monedaEvento,
            fecha,
            elementoOrigenId: origenId,
            ...(categoriaId ? { categoriaId } : {}),
            ...(glosa.trim() ? { glosa: glosa.trim() } : {}),
            ...(etiquetaIds.length ? { etiquetaIds } : {}),
            ...(meta ? { asignacionId: meta.asignacionId } : {}),
            partes: compartidoCon.map((x) => ({ usuarioId: x.usuarioId, monto: parte })),
            cuentaDestinoId: recibe.id,
          },
          token,
          key,
        );
        toast.mostrar(`Le pedimos su parte a ${nombresCompartido}`);
        permitirSalida();
        nav.back();
        return;
      }
      await api.comando<EventoFinancieroDTO>(
        '/comandos/RegistrarEventoFinanciero',
        {
          tipo,
          monto: Number(monto),
          moneda: monedaEvento,
          fecha,
          ...(necesitaOrigen && origenId ? { elementoOrigenId: origenId } : {}),
          ...(necesitaDestino && destinoId ? { elementoDestinoId: destinoId } : {}),
          ...(puedeCategorizar && categoriaId ? { categoriaId } : {}),
          ...(glosa.trim() || glosaYaPaso ? { glosa: glosa.trim() || glosaYaPaso } : {}),
          ...(etiquetaIds.length ? { etiquetaIds } : {}),
          ...(meta ? { asignacionId: meta.asignacionId } : {}),
        },
        token,
        key,
      );
      const aviso = await programarRepeticion();
      if (meta) {
        const resto = meta.objetivoId
          ? await api
              .get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${meta.objetivoId}`, token)
              .then((o) => `: ahora tiene ${money(o.progreso, o.moneda)}`)
              .catch(() => '')
          : '';
        toast.mostrar(`Salió de tu meta ${meta.nombre}${resto}${aviso}`);
      } else {
        toast.mostrar(`Movimiento registrado${aviso}`);
      }
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!elementos) {
    return (
      <Screen>
        <Skeleton filas={2} />
      </Screen>
    );
  }

  // HZ-17: agrupadas por tipo; "A qué cuenta" no repite la de "Desde" y, en una
  // transferencia, suma las cuentas de los otros miembros agrupadas por persona.
  const propios = new Set(elementos.map((e) => e.id));
  // La plata de otra persona entra o sale de una cuenta: no de un bien, un
  // crédito ni el saldo con una persona (CUENTA_NO_VALIDA en el backend).
  // G39: un gasto (tuyo o de otra persona) sale de algo que paga: no de un bien
  // ni de lo que te deben. Al pagar una deuda, de una cuenta.
  const cuentasValidas = esPago
    ? elementos.filter(pagaCon)
    : esOtra || tipo === 'GASTO'
      ? elementos.filter(
          (e) =>
            e.categoriaFuncional !== 'ACTIVO' &&
            e.categoriaFuncional !== 'CREDITO' &&
            e.naturaleza !== 'CUSTODIA_INFORMAL',
        )
      : elementos;
  // Lo que debes se dice en positivo ("Debes 380.000"), como al pagar.
  const subDeuda = (e: ElementoPatrimonialDTO) => `Debes ${money(e.valorPendiente ?? Math.abs(e.valorVigente), e.moneda)}`;
  const opcionesDesde = opcionesDeElementos(cuentasValidas, { emojis: emojis.elementos }).map((o) => {
    const e = cuentasValidas.find((x) => x.id === o.value);
    return tipo === 'GASTO' && o.grupo === 'Deudas' && e ? { ...o, grupo: '💳 Tarjetas y créditos', sub: subDeuda(e) } : o;
  });
  const opcionesA = esPago
    ? opcionesDeElementos(deudasPagables, { emojis: emojis.elementos }).map((o) => {
        const d = deudasPagables.find((x) => x.id === o.value);
        return d ? { ...o, sub: subDeuda(d) } : o;
      })
    : [
        ...opcionesDeElementos(cuentasValidas, { excluir: origenId, emojis: emojis.elementos }),
        ...(tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION'
          ? opcionesDeMiembros(elementosHogar.filter((e) => !propios.has(e.id)), { excluir: origenId, emojis: emojis.elementos })
          : []),
      ];
  // F-5: cuánto debes de la deuda elegida y su cuota, para llenar el monto de un toque.
  const deudaElegida = esPago ? deudasPagables.find((e) => e.id === destinoId) : undefined;
  const pendiente = deudaElegida ? (deudaElegida.valorPendiente ?? Math.abs(deudaElegida.valorVigente)) : 0;
  const cuota = deudaElegida?.cuotaMonto ?? null;

  // G39 (F-4): las personas a la vista y cómo se elige una.
  const personasALaVista = personasPrimero(opcionesP).slice(0, PERSONAS_A_LA_VISTA);
  const elegirPersona = (v: string | null) => {
    setPersona(v);
    setPrevio(null);
    setEraSuya(false);
    setIngresoId(null);
  };
  // G39 (F-13): lo pendiente con la persona, para llenar el monto de un toque.
  const pendientePersona =
    esOtra && persona && persona !== NUEVA && !esMiembro
      ? tipo === 'GASTO' && saldoActual < 0
        ? { label: `💵 Todo lo de ${persona}`, monto: -saldoActual }
        : tipo === 'INGRESO' && saldoActual > 0
          ? { label: '💵 Lo que te debe', monto: saldoActual }
          : null
      : null;

  // G39 (F-11): lo que ya te transfirieron en los últimos 30 días, y el detalle
  // que queda en el gasto ("Juan puso 100.000").
  const yaTePasaron = (transferenciasHogar ?? []).filter(
    (t) => t.direccion === 'RECIBIDA' && compartidoCon.some((x) => x.usuarioId === t.miembro.id),
  );
  const glosaYaPaso =
    esCompartido && yaPaso && parte > 0
      ? compartidoCon.length > 1
        ? `${nombresCompartido} pusieron ${money(parte, monedaEvento)} cada uno`
        : `${nombresCompartido} puso ${money(parte, monedaEvento)}`
      : '';

  // G39 (F-9): en Moví plata, a una cuenta tuya o a alguien del hogar.
  const muestraHacia = (tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION') && !esPago && otrosMiembros.length > 0;
  const cuentasDe = (usuarioId: string) =>
    elementosHogar.filter((e) => !propios.has(e.id) && e.propietarios[0]?.usuarioId === usuarioId);
  const duenoDestino = destinoId && !propios.has(destinoId)
    ? elementosHogar.find((e) => e.id === destinoId)?.propietarios[0]?.usuarioId ?? null
    : null;
  const haciaEfectivo = hacia ?? duenoDestino ?? 'MIA';
  const haciaMiembro = muestraHacia ? otrosMiembros.find((x) => x.usuarioId === haciaEfectivo) : undefined;
  const elegirHacia = (v: string) => {
    setHacia(v);
    const cs = v === 'MIA' ? null : cuentasDe(v);
    const sirve = destinoId && (cs ? cs.some((e) => e.id === destinoId) : propios.has(destinoId));
    if (!sirve) setDestinoId(cs && cs.length === 1 ? cs[0].id : null);
  };
  const opcionesDestino = haciaMiembro
    ? opcionesDeElementos(cuentasDe(haciaMiembro.usuarioId), { emojis: emojis.elementos }).map((o) => {
        const e = elementosHogar.find((x) => x.id === o.value);
        return { ...o, grupo: undefined, sub: e?.valorOculto ? undefined : o.sub };
      })
    : muestraHacia
      ? opcionesDeElementos(cuentasValidas, { excluir: origenId, emojis: emojis.elementos })
      : opcionesA;
  // Al pagar o al mandarle a alguien, primero a dónde va y después de qué cuenta sale.
  const destinoPrimero = esPago || muestraHacia;

  const nombreDe = (id: string | null) =>
    [...elementos, ...elementosHogar].find((e) => e.id === id)?.nombre ?? '';
  const puedeEnviar =
    !futuroNoSe &&
    Number(monto) > 0 &&
    (!necesitaOrigen || !!origenId) &&
    (!necesitaDestino || !!destinoId) &&
    origenId !== destinoId &&
    (!esCompartido || (!errParte && (yaPaso || (!!recibe && !oculta(recibe))))) &&
    (!esOtra ||
      (!!nombrePersona &&
        !esMiembro &&
        (!pidePrevio || (previo !== null && (previo !== 'ANOTADA' || !!ingreso)))));

  // D-8: lo que alguien del hogar te transfirió en los últimos 30 días.
  const delHogar = (transferenciasHogar ?? []).filter((t) => t.direccion === 'RECIBIDA');

  // Resumen fijo abajo: una frase dice qué va a pasar (plantilla Formulario).
  const m = money(Number(monto) || 0, monedaEvento);
  const saldoQueda = saldoResultante(saldoActual, direccion, Number(monto) || 0, previo && pidePrevio
    ? { tipo: previo, montoIngreso: ingreso?.monto }
    : undefined);
  // G39: el pie dice solo lo que falta (la cuenta puede venir elegida).
  const faltan = [
    Number(monto) > 0 ? null : 'el monto',
    esOtra && !nombrePersona ? 'de quién es' : null,
    pidePrevio && previo === null ? 'de dónde sale la plata' : null,
    necesitaOrigen && !origenId ? (necesitaDestino ? 'de qué cuenta sale' : 'la cuenta') : null,
    necesitaDestino && !destinoId ? (necesitaOrigen ? 'a qué cuenta llega' : 'la cuenta') : null,
  ].filter(Boolean) as string[];
  const faltaTexto = faltan.length
    ? `Completa ${faltan.length > 1 ? `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}` : faltan[0]}.`
    : 'Revisa los datos.';
  const resumen: ReactNode = esOtra
    ? !puedeEnviar
      ? faltaTexto
      : `${tipo === 'GASTO' ? `Salen ${m} de ${nombreDe(origenId)}` : `Entran ${m} a ${nombreDe(destinoId)}`}. No es ${
          tipo === 'GASTO' ? 'gasto' : 'ingreso'
        } tuyo: ${saldoClaro(nombrePersona, saldoQueda, monedaEvento, money)}.`
    : !puedeEnviar && esCompartido && (errParte || (!yaPaso && oculta(recibe)))
    ? errParte || `${nombresCompartido} tiene que poder transferirte a ${recibe?.nombre}.`
    : !puedeEnviar
    ? faltaTexto
    : esCompartido && yaPaso
      ? `Salen ${m} de ${nombreDe(origenId)}${meta ? `, de la plata de ${meta.nombre}` : ''}. ${nombresCompartido} ya te ${
          compartidoCon.length > 1 ? 'pasaron' : 'pasó'
        } sus ${money(parte, monedaEvento)}${compartidoCon.length > 1 ? ' cada uno' : ''}: no le pedimos nada.`
    : esCompartido
      ? `Salen ${m} de ${nombreDe(origenId)}${meta ? `, de la plata de ${meta.nombre}` : ''}. Le pedimos a ${nombresCompartido} sus ${money(parte, monedaEvento)}${
          compartidoCon.length > 1 ? ' cada uno' : ''
        }: le llega un aviso para transferirte a ${recibe?.nombre ?? 'tu cuenta'}.`
    : haciaMiembro && destinoId
      ? `Le pasas ${m} a ${haciaMiembro.nombre} (${nombreDe(destinoId)}) desde ${nombreDe(origenId)}. Hazla en tu banco; acá solo queda anotada. ${haciaMiembro.nombre} no tiene que anotar nada.`
    : tipo === 'GASTO'
      ? `Salen ${m} de ${nombreDe(origenId)}${meta ? `, de la plata de ${meta.nombre}` : ''}.`
      : tipo === 'INGRESO'
        ? `Entran ${m} a ${nombreDe(destinoId)}.`
        : tipo === 'TRANSFERENCIA' && deudaElegida
          ? `Pagas ${m} de ${deudaElegida.nombre} desde ${nombreDe(origenId)}. ${
              Number(monto) <= pendiente
                ? `Te quedan ${money(pendiente - Number(monto), deudaElegida.moneda)} por pagar.`
                : `⚠️ Es más de lo que debes (${money(pendiente, deudaElegida.moneda)}).`
            }`
        : tipo === 'TRANSFERENCIA'
          ? `Pasas ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)}. No cuenta como gasto.`
          : `Cambias ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)} al tipo de cambio vigente.`;
  // G39: el pie dice también en qué y cuándo (lo que vino elegido se ve).
  const hoyISO = aISO(new Date());
  const ayerISO = aISO(new Date(Date.now() - DIA));
  const cuando = fecha === hoyISO ? 'hoy' : fecha === ayerISO ? 'ayer' : diaCorto(fecha);
  const detalleResumen = [puedeCategorizar && !esOtra ? categoriaElegida?.nombre : null, cuando].filter(Boolean).join(' · ');
  const conDetalle =
    typeof resumen === 'string' && puedeEnviar ? resumen.replace(/\.( |$)/, ` · ${detalleResumen}.$1`) : resumen;
  const preguntaDia = tipo === 'INGRESO' ? 'si llegó' : tipo === 'GASTO' ? 'si se pagó' : 'si se hizo';
  const resumenFuturo = `Lo dejamos anotado para el ${diaCorto(fecha)}. Ese día te preguntamos ${preguntaDia}${
    repite !== 'NO' ? `, y después ${cadaCuando(repite, fecha)}` : ''
  }.`;
  const conRepite =
    typeof resumen === 'string' && puedeEnviar && repiteAplica && repite !== 'NO' ? `${conDetalle} Te avisamos ${cadaCuando(repite, fecha)}.` : conDetalle;
  // G35: con todo listo, el resumen lleva el emoji de la puerta.
  const resumenFinal: ReactNode = futuroNoSe
    ? 'Esto se anota el día que pase: con una fecha futura solo se programa lo tuyo.'
    : esFuturo && puedeEnviar
      ? `🗓️ ${resumenFuturo}`
      : puedeEnviar
        ? `${emojiBanda} ${conRepite}`
        : conRepite;
  const accion = esPago
    ? '💳 Pagar'
    : {
        GASTO: 'Anotar gasto',
        INGRESO: 'Anotar ingreso',
        TRANSFERENCIA: 'Anotar movimiento',
        CONVERSION: 'Anotar cambio de moneda',
      }[tipo];
  const accionFinal = esOtra
    ? 'Anotar plata de otra persona'
    : esFuturo
      ? `🗓️ Programar ${tipo === 'INGRESO' ? 'ingreso' : tipo === 'GASTO' ? 'gasto' : esPago ? 'pago' : 'movimiento'}`
      : accion;

  const opcionesQuien =
    tipo === 'GASTO'
      ? [
          { value: 'MIO', label: 'Mío', emoji: '🙋', sub: 'Lo pagaste tú y es tuyo' },
          ...(otrosMiembros.length > 0
            ? [
                {
                  value: 'HOGAR',
                  emoji: '👫',
                  label: otrosMiembros.length === 1 ? `Con ${nombreMiembro}` : 'Con el hogar',
                  sub:
                    otrosMiembros.length === 1
                      ? `Pagaste algo de los dos y ${nombreMiembro} te transfiere su parte`
                      : 'Pagaste algo de todos y te transfieren su parte',
                },
              ]
            : []),
          { value: 'OTRA', label: 'De otra persona', emoji: '👤', sub: 'Pagaste por alguien, o usaste o devolviste su plata' },
        ]
      : [
          { value: 'MIO', label: 'Mía', emoji: '🙋', sub: 'Es plata tuya' },
          { value: 'OTRA', label: 'De otra persona', emoji: '👤', sub: 'Te la pasaron, te la prestaron o te devolvieron algo' },
          ...(otrosMiembros.length > 0
            ? [{ value: 'HOGAR', label: 'De alguien del hogar', emoji: '👥', sub: `Te la transfirió ${nombreMiembro}` }]
            : []),
        ];

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca
  // el paso actual. La fecha ya trae valor (hoy), así que cuenta como hecha.
  const paso = contadorPasos();
  const pMonto = paso({ hecho: Number(monto) > 0 });
  // HZ-22: la decisión que cambia el significado del registro va en el paso 2.
  // G39: de quién es la plata se puede elegir antes del monto (el monto puede salir de la persona, F-13).
  const pQuien = puedeCategorizar ? paso({ hecho: true, libre: true }) : undefined;
  const delHogarModo = tipo === 'INGRESO' && quien === 'HOGAR';
  const pYaPaso = esCompartido ? paso({ hecho: true }) : undefined;
  const pParte = esCompartido ? paso({ hecho: Number(monto) > 0 && !errParte }) : undefined;
  // G39: "¿En qué?" va antes de la cuenta (monto, para qué, cuenta, cuándo).
  const pCategoria = puedeCategorizar && !esOtra ? paso({ opcional: true }) : undefined;
  const pPersona = esOtra ? paso({ hecho: !!nombrePersona, libre: true }) : undefined;
  const pPrevio = pidePrevio ? paso({ hecho: previo !== null }) : undefined;
  const pIngreso = pidePrevio && previo === 'ANOTADA' ? paso({ hecho: !!ingreso }) : undefined;
  // G39 (F-5): al pagar, primero qué deuda y después desde qué cuenta.
  const pHacia = muestraHacia ? paso({ hecho: true }) : undefined;
  const pAPago = destinoPrimero && necesitaDestino ? paso({ hecho: !!destinoId }) : undefined;
  const pDesde = necesitaOrigen ? paso({ hecho: !!origenId }) : undefined;
  const pMeta = tipo === 'GASTO' && !esOtra && metasCuenta.length > 0 ? paso({ opcional: true }) : undefined;
  const pRecibe = esCompartido && !yaPaso ? paso({ hecho: !!recibe && !oculta(recibe) }) : undefined;
  const pA = pAPago ?? (necesitaDestino ? paso({ hecho: !!destinoId }) : undefined);
  const pFecha = paso({ hecho: !!fecha });

  // G39 (F-11): los tres a la vista; una línea dice qué significa el elegido.
  const quienElegido = opcionesQuien.find((o) => o.value === quien);
  const pasoQuien = pQuien ? (
    <BloquePaso paso={pQuien} style={styles.group}>
      <Question paso={pQuien}>{tipo === 'GASTO' ? '¿De quién es este gasto?' : '¿De quién es esta plata?'}</Question>
      <View style={styles.frecuentes}>
        {opcionesQuien.map((o) => (
          <Pastilla
            key={o.value}
            label={`${o.emoji} ${o.label}`}
            activo={quien === o.value}
            onPress={() => setQuien(o.value as Quien)}
          />
        ))}
      </View>
      {quienElegido?.sub ? <Nota>{`${quienElegido.emoji} ${quienElegido.sub}`}</Nota> : null}
    </BloquePaso>
  ) : null;

  // D-8: "De alguien del hogar" no crea nada; la transferencia la anota quien la envía.
  if (delHogarModo) {
    const cuentasDeMiembro = elementos.filter(
      (e) => RECIBEN.includes(e.categoriaFuncional) && e.naturaleza !== 'CUSTODIA_INFORMAL',
    );
    const cuentaLlegada = cuentasDeMiembro.find((e) => e.id === destinoId);
    const avisado = otrosMiembros.length === 1 ? otrosMiembros[0] : otrosMiembros.find((x) => x.usuarioId === avisarA);
    return (
      <Screen
        pie={
          <>
            <Nota>No se anota nada: así la plata no queda dos veces.</Nota>
            <Button
              title="Listo"
              onPress={() => {
                permitirSalida();
                nav.back();
              }}
            />
          </>
        }
      >
        <MontoBanda paso={pMonto} value={monto} onChange={setMonto} moneda={monedaEvento} color={colorBanda} emoji={emojiBanda} />
        {pasoQuien}
        <Nota>
          {`Una transferencia entre ustedes la anota quien la envía, en «Moví plata». Esto te llegó de ${
            otrosMiembros.length === 1 ? nombreMiembro : 'tu hogar'
          } en los últimos 30 días:`}
        </Nota>
        {transferenciasHogar === null ? (
          <Skeleton filas={2} />
        ) : delHogar.length === 0 ? (
          <Nota>No llegó nada.</Nota>
        ) : (
          <ListCard>
            {delHogar.map((t) => (
              <TxRow
                key={t.eventoId}
                title={`De ${t.miembro.nombre}`}
                subtitle={`${t.cuentaPropia.nombre} · ${t.fecha}`}
                amount={money(t.monto, t.moneda)}
                positivo
                logo={{ emoji: '👥' }}
              />
            ))}
          </ListCard>
        )}
        <Section title="¿No aparece?">
          <Nota>{`Le avisamos a ${otrosMiembros.length === 1 ? nombreMiembro : 'quien te la envió'} para que la anote.`}</Nota>
          {otrosMiembros.length > 1 && (
            <Elegir
              label="¿Quién te la transfirió?"
              placeholder="Elegir"
              value={avisarA}
              options={otrosMiembros.map((x) => ({ value: x.usuarioId, label: x.nombre }))}
              onChange={setAvisarA}
            />
          )}
          <Elegir
            label="¿A qué cuenta te llegó?"
            placeholder="Elegir cuenta"
            value={destinoId}
            options={opcionesDeElementos(cuentasDeMiembro, { emojis: emojis.elementos })}
            onChange={setDestinoId}
          />
          {oculta(cuentaLlegada) && cuentaLlegada ? (
            <>
              <Nota>{`${avisado?.nombre ?? 'Tu hogar'} no ve esta cuenta, así que no puede anotar la transferencia.`}</Nota>
              <Button
                title={`Que ${avisado ? `${avisado.nombre} pueda` : 'puedan'} transferirme aquí`}
                variant="secondary"
                onPress={() => dejarTransferir(cuentaLlegada.id)}
                loading={compartiendo}
              />
            </>
          ) : null}
          <Cuando value={fecha} onChange={setFecha} />
          <Button
            title={`Avisarle a ${avisado?.nombre ?? 'quien te la envió'}`}
            variant="secondary"
            onPress={() => avisado && avisar(avisado.usuarioId, avisado.nombre)}
            loading={avisando}
            disabled={!(Number(monto) > 0) || !avisado || !cuentaLlegada || oculta(cuentaLlegada)}
          />
        </Section>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  const bloqueDestino = !necesitaDestino ? null : haciaMiembro && opcionesDestino.length === 0 ? (
    <BloquePaso paso={pA} style={styles.group}>
      <Question paso={pA}>{`¿A qué cuenta de ${haciaMiembro.nombre}?`}</Question>
      <Nota>{`🔒 ${haciaMiembro.nombre} todavía no te deja ver sus cuentas. Pídele que, en su teléfono, abra su cuenta › ⚙️ Ajustes de la cuenta › 👥 Con el hogar.`}</Nota>
    </BloquePaso>
  ) : (
    <Elegir
      label={
        esPago
          ? '¿Qué deuda pagas?'
          : haciaMiembro
            ? `¿A qué cuenta de ${haciaMiembro.nombre}?`
            : tipo === 'INGRESO'
              ? '¿A qué cuenta llegó?'
              : '¿A qué cuenta?'
      }
      paso={pA}
      placeholder={esPago ? 'Elegir deuda' : 'Elegir cuenta'}
      value={destinoId}
      options={opcionesDestino}
      onChange={setDestinoId}
    />
  );
  const bloqueHacia = pHacia ? (
    <BloquePaso paso={pHacia} style={styles.group}>
      <Question paso={pHacia}>¿A dónde va la plata?</Question>
      <View style={styles.frecuentes}>
        <Pastilla label="🙋 A otra cuenta mía" activo={haciaEfectivo === 'MIA'} onPress={() => elegirHacia('MIA')} />
        {otrosMiembros.map((x) => (
          <Pastilla
            key={x.usuarioId}
            label={`👤 A ${x.nombre}`}
            activo={haciaEfectivo === x.usuarioId}
            onPress={() => elegirHacia(x.usuarioId)}
          />
        ))}
      </View>
    </BloquePaso>
  ) : null;

  return (
    <Screen
      pie={
        <>
          <Nota>{resumenFinal}</Nota>
          <Button title={accionFinal} onPress={onSubmit} loading={loading} disabled={!puedeEnviar} />
        </>
      }
    >
      <MontoBanda paso={pMonto} value={monto} onChange={setMonto} moneda={monedaEvento} color={colorBanda} emoji={emojiBanda}>
        {esFuturo ? (
          <Text style={[styles.frecuentesTitulo, { color: c.text, opacity: 1 }]}>{`🗓️ Para el ${diaCorto(fecha)}: se anota ese día`}</Text>
        ) : null}
        {pendientePersona ? (
          <View style={styles.frecuentes}>
            <Pastilla
              label={`${pendientePersona.label} · ${money(pendientePersona.monto, monedaEvento)}`}
              activo={Number(monto) === pendientePersona.monto}
              onPress={() => setMonto(String(pendientePersona.monto))}
            />
          </View>
        ) : null}
        {deudaElegida && (pendiente > 0 || (cuota ?? 0) > 0) ? (
          <View style={styles.frecuentes}>
            {pendiente > 0 && (
              <Pastilla
                label={`💳 Todo lo que debes · ${money(pendiente, deudaElegida.moneda)}`}
                activo={Number(monto) === pendiente}
                onPress={() => setMonto(String(pendiente))}
              />
            )}
            {cuota != null && cuota > 0 && (
              <Pastilla
                label={`💵 La cuota · ${money(cuota, deudaElegida.moneda)}`}
                activo={Number(monto) === cuota}
                onPress={() => setMonto(String(cuota))}
              />
            )}
          </View>
        ) : null}
        {esPago && frecuentes.length === 0 ? null : frecuentes.length === 0 ? (
          <View style={styles.frecuentes}>
            <Text style={[styles.frecuentesTitulo, { color: c.text }]}>{`⚡ Aún no tienes frecuentes de ${DE_TIPO[tipo]}`}</Text>
            <Pastilla
              label="➕ Crear uno"
              enlace
              onPress={() => nav.go('PlantillaForm', { tipo: tipo === 'CONVERSION' ? 'TRANSFERENCIA' : tipo })}
            />
          </View>
        ) : (
          <View style={styles.frecuentes}>
            <Text style={[styles.frecuentesTitulo, { color: c.text }]}>{`⚡ Tus frecuentes (${frecuentes.length})`}</Text>
            {frecuentes.slice(0, FRECUENTES_A_LA_VISTA).map((p) => (
              <Pastilla
                key={p.id}
                label={p.monto != null ? `${emojiFrecuente(p)} ${p.nombre} · ${money(p.monto, p.moneda ?? 'CLP')}` : `${emojiFrecuente(p)} ${p.nombre}`}
                accessibilityLabel={`Usar frecuente ${p.nombre}`}
                onPress={() => aplicarPlantilla(p)}
              />
            ))}
            {frecuentes.length > FRECUENTES_A_LA_VISTA && (
              <Elegir
                label={`Tus frecuentes de ${DE_TIPO[tipo]}`}
                value={null}
                options={frecuentes.map((p) => ({
                  value: p.id,
                  label: p.nombre,
                  emoji: emojiFrecuente(p),
                  sub: [
                    p.monto != null ? money(p.monto, p.moneda ?? 'CLP') : null,
                    nombreDe(p.elementoOrigenId ?? p.elementoDestinoId ?? null) || null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined,
                }))}
                onChange={(id) => {
                  const p = frecuentes.find((x) => x.id === id);
                  if (p) aplicarPlantilla(p);
                }}
                boton={(abrir) => <Pastilla label={`🔍 Ver los ${frecuentes.length}`} enlace onPress={abrir} />}
              />
            )}
          </View>
        )}
      </MontoBanda>
      {tipo === 'CONVERSION' && (
        <Nota>El monto va en la moneda de la cuenta de salida; la otra recibe el equivalente al tipo de cambio vigente.</Nota>
      )}

      {pasoQuien}

      {pYaPaso && (
        <BloquePaso paso={pYaPaso} style={styles.group}>
          <Question paso={pYaPaso}>{`¿${nombresCompartido || nombreMiembro} ya te ${compartidoCon.length > 1 ? 'pasaron' : 'pasó'} su parte?`}</Question>
          <View style={styles.frecuentes}>
            <Pastilla label={`⏳ No, que me la ${compartidoCon.length > 1 ? 'pasen' : 'pase'}`} activo={!yaPaso} onPress={() => setYaPaso(false)} />
            <Pastilla label={`✅ Sí, ya me la ${compartidoCon.length > 1 ? 'pasaron' : 'pasó'}`} activo={yaPaso} onPress={() => setYaPaso(true)} />
          </View>
          {yaPaso ? (
            transferenciasHogar === null ? (
              <Skeleton filas={1} />
            ) : yaTePasaron.length > 0 ? (
              <ListCard>
                {yaTePasaron.slice(0, 3).map((t) => (
                  <TxRow
                    key={t.eventoId}
                    title={`✅ ${t.miembro.nombre} te pasó ${money(t.monto, t.moneda)}`}
                    subtitle={`${diaCorto(t.fecha)} · a ${t.cuentaPropia.nombre}`}
                    amount=""
                    logo={{ emoji: '👥' }}
                  />
                ))}
              </ListCard>
            ) : (
              <Nota>{`No vemos transferencias de ${nombresCompartido || nombreMiembro} en los últimos 30 días. Si te la pasó de otra forma, igual puedes seguir.`}</Nota>
            )
          ) : null}
        </BloquePaso>
      )}

      {pParte && (
        <BloquePaso paso={pParte} style={styles.group}>
          {otrosMiembros.length === 1 ? (
            <>
              <Elegir
                label={yaPaso ? `¿Cuánto era de ${nombreMiembro}?` : `¿Cuánto le toca a ${nombreMiembro}?`}
                paso={pParte}
                value={reparto}
                options={[
                  {
                    value: 'MITAD',
                    label: 'La mitad',
                    emoji: '➗',
                    sub: Number(monto) > 0 ? money(parteIgual(Number(monto), 1, monedaEvento), monedaEvento) : undefined,
                  },
                  { value: 'OTRO', label: 'Otro monto', emoji: '✏️' },
                ]}
                onChange={(v) => setReparto((v as 'MITAD' | 'OTRO' | null) ?? 'MITAD')}
              />
              {reparto === 'OTRO' && (
                <MoneyField
                  label={`Monto de ${nombreMiembro}`}
                  value={parteOtro}
                  onChange={setParteOtro}
                  moneda={monedaEvento}
                />
              )}
            </>
          ) : (
            <>
              <ElegirVarios
                label="¿Con quiénes?"
                values={conQuienes ?? otrosMiembros.map((x) => x.usuarioId)}
                onChange={setConQuienes}
                options={otrosMiembros.map((x) => ({ value: x.usuarioId, label: x.nombre, emoji: '🙂' }))}
              />
              {compartidoCon.length > 0 && Number(monto) > 0 ? (
                <Nota>{`Partes iguales: ${money(parte, monedaEvento)} cada uno.`}</Nota>
              ) : null}
            </>
          )}
          {errParte && (reparto === 'OTRO' ? !!parteOtro : true) ? (
            <ErrorText>{errParte}</ErrorText>
          ) : (
            !yaPaso && <Nota>{`Le pedimos su parte a ${nombresCompartido || 'tu hogar'} y te la transfiere. Lo ves en la pestaña Hogar.`}</Nota>
          )}
        </BloquePaso>
      )}

      {pCategoria && (
        <BloquePaso paso={pCategoria} style={styles.group}>
          {masUsadas.length > 0 ? (
            <>
              <Question paso={pCategoria}>{preguntaCategoria}</Question>
              <View style={styles.frecuentes}>
                {masUsadas.map((x) => (
                  <Pastilla
                    key={x.id}
                    label={`${emojiCategoria(x) ?? '🏷️'} ${x.nombre}`}
                    activo={categoriaId === x.id}
                    onPress={() => setCategoriaId((actual) => (actual === x.id ? null : x.id))}
                  />
                ))}
                {categoriaElegida && !masUsadas.some((x) => x.id === categoriaElegida.id) ? (
                  <Pastilla
                    label={`${emojiCategoria(categoriaElegida) ?? '🏷️'} ${categoriaElegida.nombre}`}
                    activo
                    onPress={() => setCategoriaId(null)}
                  />
                ) : null}
                <Elegir
                  label={preguntaCategoria}
                  opcionNula="Sin categoría"
                  value={categoriaId}
                  options={opcionesCategoria}
                  onChange={elegirCategoria}
                  boton={(abrir) => <Pastilla label="🔍 Otra" enlace onPress={abrir} />}
                />
              </View>
            </>
          ) : (
            <Elegir
              label={preguntaCategoria}
              paso={pCategoria}
              opcionNula="Sin categoría"
              value={categoriaId}
              options={opcionesCategoria}
              onChange={elegirCategoria}
            />
          )}
          {crearCat ? (
            <View style={styles.group}>
              <Field
                label=""
                value={catNombre}
                onChangeText={setCatNombre}
                autoCapitalize="sentences"
                placeholder={`Nueva categoría de ${etiqueta(tipo).toLowerCase()}`}
                autoFocus
              />
              <View style={styles.fila}>
                <View style={{ flex: 1 }}>
                  <Button title="Crear" variant="secondary" onPress={crearCategoriaInline} loading={catBusy} disabled={!catNombre.trim()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Cancelar" variant="secondary" onPress={() => setCrearCat(false)} />
                </View>
              </View>
            </View>
          ) : null}
        </BloquePaso>
      )}


      {pPersona && (
        <BloquePaso paso={pPersona} style={styles.group}>
          {/* G39 (F-4): las personas con algo pendiente primero, a un toque. */}
          <Question paso={pPersona}>¿De quién?</Question>
          <View style={styles.frecuentes}>
            {personasALaVista.map((x) => (
              <Pastilla key={x.nombre} label={`👤 ${x.nombre}`} activo={persona === x.nombre} onPress={() => elegirPersona(x.nombre)} />
            ))}
            {persona && persona !== NUEVA && !personasALaVista.some((x) => x.nombre === persona) ? (
              <Pastilla label={`👤 ${persona}`} activo onPress={() => elegirPersona(null)} />
            ) : null}
            <Pastilla label="➕ Otra persona" activo={persona === NUEVA} onPress={() => elegirPersona(NUEVA)} />
            {opcionesP.length > PERSONAS_A_LA_VISTA && (
              <Elegir
                label="¿De quién?"
                value={persona}
                options={opcionesP.map((x) => ({
                  value: x.nombre,
                  label: x.nombre,
                  emoji: '👤',
                  sub: saldoTexto(x.nombre, x.saldo, monedaEvento, money),
                }))}
                onChange={elegirPersona}
                boton={(abrir) => <Pastilla label={`🔍 Ver todas (${opcionesP.length})`} enlace onPress={abrir} />}
              />
            )}
          </View>
          {persona && persona !== NUEVA && !esMiembro ? (
            <Nota>{`${saldoActual < 0 ? '💵' : saldoActual > 0 ? '🤝' : '👌'} ${mayus(saldoClaro(persona, saldoActual, monedaEvento, money))}.${
              pendientePersona && !(Number(monto) > 0) ? ` Para usar todo, toca «${pendientePersona.label}» arriba.` : ''
            }`}</Nota>
          ) : null}
          {persona === NUEVA && (
            <Field
              label="¿Cómo se llama?"
              value={nuevoNombre}
              onChangeText={(t) => {
                setNuevoNombre(t);
                setPrevio(null);
              }}
              autoCapitalize="words"
              maxLength={80}
              autoFocus
            />
          )}
          {esMiembro ? (
            <ErrorText>{`${esMiembro.nombre} es parte del hogar. Para plata entre ustedes usa «Moví plata».`}</ErrorText>
          ) : (
            <Nota>{tipo === 'GASTO' ? 'No cuenta como gasto tuyo.' : 'No cuenta como ingreso tuyo.'}</Nota>
          )}
        </BloquePaso>
      )}

      {pPrevio && (
        <BloquePaso paso={pPrevio} style={styles.group}>
          <Question paso={pPrevio}>¿De dónde sale esta plata?</Question>
          <View style={styles.frecuentes}>
            <Pastilla
              label={`🤝 La pongo yo: ${nombrePersona} me la devuelve`}
              activo={previo === 'DEVOLVER'}
              onPress={() => {
                setEraSuya(false);
                setPrevio('DEVOLVER');
                setIngresoId(null);
              }}
            />
            <Pastilla
              label={`💵 Es de ${nombrePersona}: me la había pasado`}
              activo={eraSuya}
              onPress={() => {
                setEraSuya(true);
                setPrevio(null);
                setIngresoId(null);
              }}
            />
          </View>
          {eraSuya ? (
            <>
              <Question>¿La anotaste cuando te llegó?</Question>
              <View style={styles.frecuentes}>
                <Pastilla label="No la anoté" activo={previo === 'NO_ANOTADA'} onPress={() => setPrevio('NO_ANOTADA')} />
                <Pastilla
                  label="Sí, como ingreso mío"
                  activo={previo === 'ANOTADA'}
                  onPress={() => {
                    setPrevio('ANOTADA');
                    setIngresoId(null);
                  }}
                />
              </View>
              {previo === 'ANOTADA' ? <Nota>Elige cuál: lo corregimos para que no cuente como tuyo.</Nota> : null}
            </>
          ) : null}
        </BloquePaso>
      )}

      {pIngreso && (
        <BloquePaso paso={pIngreso} style={styles.group}>
          {eventosCuentas === null ? (
            <Skeleton filas={1} />
          ) : (
            <Elegir
              label="¿Cuál ingreso era?"
              paso={pIngreso}
              placeholder={ingresosOpc.length ? 'Elegir ingreso' : 'No hay ingresos en los últimos 90 días'}
              value={ingresoId}
              options={ingresosOpc.map((ev) => ({
                value: ev.id,
                label: ev.glosa || 'Ingreso',
                sub: `${money(ev.monto, ev.moneda)} · ${ev.fecha.slice(0, 10)}`,
              }))}
              onChange={setIngresoId}
            />
          )}
        </BloquePaso>
      )}

      {bloqueHacia}
      {destinoPrimero && bloqueDestino}
      {esPago && recordado?.destinoId && destinoId === recordado.destinoId ? (
        <Nota>🔁 La de tu último pago. Tócala para cambiarla.</Nota>
      ) : null}
      {necesitaOrigen && (
        <Elegir
          label={tipo === 'GASTO' ? '¿Desde qué cuenta pagaste?' : '¿Desde qué cuenta?'}
          paso={pDesde}
          placeholder="Elegir cuenta"
          value={origenId}
          options={opcionesDesde}
          onChange={(v) => {
            setOrigenId(v);
            if (v === destinoId) setDestinoId(null);
          }}
        />
      )}
      {tipo === 'GASTO' && recordado?.origenId && origenId === recordado.origenId ? (
        <Nota>🔁 La de tu último gasto. Tócala para cambiarla.</Nota>
      ) : null}
      {esPago && recordado?.origenId && origenId === recordado.origenId ? (
        <Nota>🔁 La de tu último pago. Tócala para cambiarla.</Nota>
      ) : null}
      {!esPago && puerta === 'TRANSFERENCIA' && recordado?.origenId && !recordado.destinoId && origenId === recordado.origenId ? (
        <Nota>🔁 La de tu última transferencia. Tócala para cambiarla.</Nota>
      ) : null}

      {pMeta && (
        <BloquePaso paso={pMeta} style={styles.group}>
          <Elegir
            label="¿Sale de una meta? (opcional)"
            paso={pMeta}
            opcionNula="No, de la plata libre"
            value={asignacionId}
            options={metasCuenta.map((x) => ({
              value: x.asignacionId,
              label: x.nombre,
              emoji: x.objetivoId ? emojiMeta(x.objetivoId, emojis.metas) : '🐷',
              sub: money(x.monto, monedaEvento),
            }))}
            onChange={setAsignacionId}
          />
          {meta && Number(monto) > meta.monto ? (
            <Nota>
              {`${meta.nombre} tiene ${money(meta.monto, monedaEvento)} en ${cuentaOrigen?.nombre ?? 'esta cuenta'}: se descuenta eso de la meta y ${money(Number(monto) - meta.monto, monedaEvento)} de lo libre.`}
            </Nota>
          ) : null}
        </BloquePaso>
      )}

      {pRecibe && (
        <BloquePaso paso={pRecibe} style={styles.group}>
          <Elegir
            label={`¿A qué cuenta te ${compartidoCon.length > 1 ? 'transfieren' : 'transfiere'}?`}
            paso={pRecibe}
            placeholder="Elegir cuenta"
            value={recibe?.id ?? null}
            options={opcionesDeElementos(cuentasRecibe, { emojis: emojis.elementos })}
            onChange={setRecibeId}
          />
          {oculta(recibe) && recibe ? (
            <>
              <Nota>{`${nombresCompartido || 'Tu hogar'} no ve esta cuenta, así que no puede transferirte.`}</Nota>
              <Button
                title={`Que ${otrosMiembros.length === 1 ? `${nombreMiembro} pueda` : 'puedan'} transferirme aquí`}
                variant="secondary"
                onPress={() => dejarTransferir(recibe.id)}
                loading={compartiendo}
              />
            </>
          ) : null}
        </BloquePaso>
      )}

      {!destinoPrimero && bloqueDestino}
      {tipo === 'INGRESO' && recordado?.destinoId && destinoId === recordado.destinoId ? (
        <Nota>🔁 La de tu último ingreso. Tócala para cambiarla.</Nota>
      ) : null}
      {!esPago && necesitaOrigen && necesitaDestino && recordado?.origenId && origenId === recordado.origenId && destinoId === recordado.destinoId ? (
        <Nota>🔁 Las de la última vez. Tócalas para cambiarlas.</Nota>
      ) : null}

      <Cuando value={fecha} onChange={setFecha} paso={pFecha} />

      <Opcionales
        items={[
          {
            clave: 'detalle',
            emoji: '📝',
            titulo: 'Detalle',
            abierto: !!glosa,
            children: (
              <Field
                label="Detalle (opcional)"
                value={glosa}
                onChangeText={setGlosa}
                placeholder="p. ej. pago internet marzo"
                autoCapitalize="sentences"
                maxLength={140}
              />
            ),
          },
          ...(repiteAplica
            ? [
                {
                  clave: 'repite',
                  emoji: '🔁',
                  titulo: 'Se repite',
                  abierto: repite !== 'NO',
                  // G39 (F-8): dos botones a la vista, sin lista. Tocar el elegido lo quita.
                  children: (
                    <View style={styles.group}>
                      <Question>¿Se repite?</Question>
                      <View style={styles.frecuentes}>
                        {REPITE_BOTONES.map((o) => (
                          <Pastilla
                            key={o.value}
                            label={o.label}
                            activo={repite === o.value}
                            onPress={() => setRepite((actual) => (actual === o.value ? 'NO' : o.value))}
                          />
                        ))}
                      </View>
                    </View>
                  ),
                },
              ]
            : []),
          ...(etiquetas.length > 0 && !esFuturo
            ? [
                {
                  clave: 'etiquetas',
                  emoji: '🏷️',
                  titulo: 'Etiquetas',
                  abierto: etiquetaIds.length > 0,
                  children: (
                    <ElegirVarios
                      label="Etiquetas (opcional)"
                      values={etiquetaIds}
                      onChange={setEtiquetaIds}
                      options={etiquetas.map((e) => ({ value: e.id, label: e.nombre, emoji: '🔖' }))}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />

      {errMismo ? <ErrorText>{errMismo}</ErrorText> : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  frecuentes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  frecuentesTitulo: { width: '100%', fontSize: 13, fontWeight: '700', opacity: 0.75 },
});
