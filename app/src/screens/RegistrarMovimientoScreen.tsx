import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { money } from '../format';
import { opcionesDeElementos, opcionesDeMiembros } from '../opciones';
import {
  opcionesDePersonas,
  saldoResultante,
  saldoTexto,
  type PersonaDTO,
  type Previo,
  type ResultadoPlataDTO,
} from '../personas';
import { nombres, parteIgual, type SolicitudDTO, type TransferenciaHogarDTO } from '../solicitudes';
import { useToast } from '../ui/Toast';
import { cadaCuando, OPCIONES_REPITE, siguienteFecha, type Periodicidad } from '../recurrencia';
import {
  Chip,
  contadorPasos,
  AmountInput,
  Elegir,
  ElegirVarios,
  BloquePaso,
  aISO,
  Button,
  Cuando,
  ErrorText,
  etiqueta,
  Field,
  LinkButton,
  ListCard,
  MoneyField,
  Question,
  Nota,
  Opcional,
  Section,
  Skeleton,
  Screen,
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

/**
 * D-8 — paso 2 de Gasté y Recibí: de quién es la plata. HOGAR es "Compartido
 * con el hogar" en Gasté (D-7) y "De alguien del hogar" en Recibí.
 */
type Quien = 'MIO' | 'OTRA' | 'HOGAR';
/** Cuentas donde se recibe una transferencia de un miembro (como en el backend). */
const RECIBEN = ['LIQUIDEZ', 'RESERVA'];
const NUEVA = '__nueva__';
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
  const [compartiendo, setCompartiendo] = useState(false);
  // Recibí → De alguien del hogar: "Avisarle a [miembro]" si la transferencia no aparece.
  const [avisarA, setAvisarA] = useState<string | null>(null);
  const [avisando, setAvisando] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useTitulo((params.titulo as string | undefined) ?? TITULOS[tipo]);

  const sucio =
    Number(monto) > 0 ||
    origenId !== origenInicial ||
    destinoId !== destinoInicial ||
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
      .get<PlantillaMovimientoDTO[]>('/usuarios/me/plantillas-movimiento', token)
      .then(setPlantillas)
      .catch(() => setPlantillas([]));
    api
      .get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token)
      .then(setEtiquetas)
      .catch(() => setEtiquetas([]));
    api
      .get<PersonaDTO[]>('/usuarios/me/personas?todas=true', token)
      .then(setPersonas)
      .catch(() => setPersonas([]));
  }, [token]);

  // Fuera de Gasté y Recibí no hay paso 2.
  useEffect(() => {
    if (tipo !== 'GASTO' && tipo !== 'INGRESO') setQuien('MIO');
  }, [tipo]);

  // D-8: los movimientos de una cuenta no dicen de quién es el otro lado; las
  // transferencias con miembros las arma el backend.
  const verDelHogar = tipo === 'INGRESO' && quien === 'HOGAR';
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
  const frecuentes = plantillas.filter((p) => p.tipo === (tipo === 'CONVERSION' ? 'TRANSFERENCIA' : tipo));

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
      if (esCompartido && recibe) {
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
          ...(glosa.trim() ? { glosa: glosa.trim() } : {}),
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
  const cuentasValidas = esOtra
    ? elementos.filter(
        (e) =>
          e.categoriaFuncional !== 'ACTIVO' &&
          e.categoriaFuncional !== 'CREDITO' &&
          e.naturaleza !== 'CUSTODIA_INFORMAL',
      )
    : elementos;
  const opcionesDesde = opcionesDeElementos(cuentasValidas);
  const opcionesA = [
    ...opcionesDeElementos(cuentasValidas, { excluir: origenId }),
    ...(tipo === 'TRANSFERENCIA' || tipo === 'CONVERSION'
      ? opcionesDeMiembros(elementosHogar.filter((e) => !propios.has(e.id)), { excluir: origenId })
      : []),
  ];

  const nombreDe = (id: string | null) =>
    [...elementos, ...elementosHogar].find((e) => e.id === id)?.nombre ?? '';
  const puedeEnviar =
    Number(monto) > 0 &&
    (!necesitaOrigen || !!origenId) &&
    (!necesitaDestino || !!destinoId) &&
    origenId !== destinoId &&
    (!esCompartido || (!errParte && !!recibe && !oculta(recibe))) &&
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
  const resumen: ReactNode = esOtra
    ? !puedeEnviar
      ? 'Completa monto, persona y cuenta.'
      : `${tipo === 'GASTO' ? `Salen ${m} de ${nombreDe(origenId)}` : `Entran ${m} a ${nombreDe(destinoId)}`}. No es ${
          tipo === 'GASTO' ? 'gasto' : 'ingreso'
        } tuyo. ${saldoTexto(nombrePersona, saldoQueda, monedaEvento, money)}.`
    : !puedeEnviar && esCompartido && (errParte || oculta(recibe))
    ? errParte || `${nombresCompartido} tiene que poder transferirte a ${recibe?.nombre}.`
    : !puedeEnviar
    ? necesitaOrigen && necesitaDestino
      ? 'Completa monto, origen y destino.'
      : 'Completa monto y cuenta.'
    : esCompartido
      ? `Salen ${m} de ${nombreDe(origenId)}${meta ? `, de la plata de ${meta.nombre}` : ''}. Le pedimos a ${nombresCompartido} su parte: ${money(parte, monedaEvento)}${compartidoCon.length > 1 ? ' cada uno' : ''}.`
    : tipo === 'GASTO'
      ? `Salen ${m} de ${nombreDe(origenId)}${meta ? `, de la plata de ${meta.nombre}` : ''}.`
      : tipo === 'INGRESO'
        ? `Entran ${m} a ${nombreDe(destinoId)}.`
        : tipo === 'TRANSFERENCIA'
          ? `Pasas ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)}. No cuenta como gasto.`
          : `Cambias ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)} al tipo de cambio vigente.`;
  const resumenFinal: ReactNode =
    typeof resumen === 'string' && puedeEnviar && repiteAplica && repite !== 'NO' ? `${resumen} Te avisamos ${cadaCuando(repite, fecha)}.` : resumen;
  const accion = {
    GASTO: 'Registrar gasto',
    INGRESO: 'Registrar ingreso',
    TRANSFERENCIA: 'Registrar transferencia',
    CONVERSION: 'Registrar cambio de moneda',
  }[tipo];
  const accionFinal = esOtra ? 'Registrar plata de otra persona' : accion;

  const opcionesQuien =
    tipo === 'GASTO'
      ? [
          { value: 'MIO', label: 'Mío' },
          ...(otrosMiembros.length > 0
            ? [
                {
                  value: 'HOGAR',
                  label: otrosMiembros.length === 1 ? `Compartido con ${nombreMiembro}` : 'Compartido con el hogar',
                  sub: `Pagaste algo de ${otrosMiembros.length === 1 ? 'los dos' : 'todos'} y te transfieren su parte`,
                },
              ]
            : []),
          { value: 'OTRA', label: 'De otra persona', sub: 'Pagaste por alguien, o usaste o devolviste su plata' },
        ]
      : [
          { value: 'MIO', label: 'Mía' },
          { value: 'OTRA', label: 'De otra persona', sub: 'Te la pasaron, te la prestaron o te devolvieron algo' },
          ...(otrosMiembros.length > 0
            ? [{ value: 'HOGAR', label: 'De alguien del hogar', sub: `Te la transfirió ${nombreMiembro}` }]
            : []),
        ];

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca
  // el paso actual. La fecha ya trae valor (hoy), así que cuenta como hecha.
  const paso = contadorPasos();
  const pMonto = paso({ hecho: Number(monto) > 0 });
  // HZ-22: la decisión que cambia el significado del registro va en el paso 2.
  const pQuien = puedeCategorizar ? paso({ hecho: true }) : undefined;
  const delHogarModo = tipo === 'INGRESO' && quien === 'HOGAR';
  const pParte = esCompartido ? paso({ hecho: Number(monto) > 0 && !errParte }) : undefined;
  const pPersona = esOtra ? paso({ hecho: !!nombrePersona }) : undefined;
  const pPrevio = pidePrevio ? paso({ hecho: previo !== null }) : undefined;
  const pIngreso = pidePrevio && previo === 'ANOTADA' ? paso({ hecho: !!ingreso }) : undefined;
  const pDesde = necesitaOrigen ? paso({ hecho: !!origenId }) : undefined;
  const pMeta = tipo === 'GASTO' && !esOtra && metasCuenta.length > 0 ? paso({ opcional: true }) : undefined;
  const pRecibe = esCompartido ? paso({ hecho: !!recibe && !oculta(recibe) }) : undefined;
  const pA = necesitaDestino ? paso({ hecho: !!destinoId }) : undefined;
  const pCategoria = puedeCategorizar && !esOtra ? paso({ opcional: true }) : undefined;
  const pFecha = paso({ hecho: !!fecha });

  const pasoQuien = pQuien ? (
    <Elegir
      label={tipo === 'GASTO' ? '¿De quién es este gasto?' : '¿De quién es esta plata?'}
      paso={pQuien}
      value={quien}
      options={opcionesQuien}
      onChange={(v) => setQuien((v as Quien | null) ?? 'MIO')}
    />
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
        <AmountInput label="¿Cuánto?" paso={pMonto} value={monto} onChange={setMonto} moneda={monedaEvento} />
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
                logo={{ icon: 'people-outline' }}
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
            options={opcionesDeElementos(cuentasDeMiembro)}
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

  return (
    <Screen
      pie={
        <>
          <Nota>{resumenFinal}</Nota>
          <Button title={accionFinal} onPress={onSubmit} loading={loading} disabled={!puedeEnviar} />
        </>
      }
    >
      {frecuentes.length > 0 && (
        <View style={styles.group}>
          <Question>Frecuentes</Question>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
            {frecuentes.map((p) => (
              <Chip
                key={p.id}
                label={p.monto != null ? `${p.nombre} · ${money(p.monto, p.moneda ?? 'CLP')}` : p.nombre}
                onPress={() => aplicarPlantilla(p)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {tipo === 'CONVERSION' && (
        <Nota>El monto va en la moneda de la cuenta de salida; la otra recibe el equivalente al tipo de cambio vigente.</Nota>
      )}
      <AmountInput label="¿Cuánto?" paso={pMonto} value={monto} onChange={setMonto} moneda={monedaEvento} />

      {pasoQuien}

      {pParte && (
        <BloquePaso paso={pParte} style={styles.group}>
          {otrosMiembros.length === 1 ? (
            <>
              <Elegir
                label={`¿Cuánto le toca a ${nombreMiembro}?`}
                paso={pParte}
                value={reparto}
                options={[
                  {
                    value: 'MITAD',
                    label: 'La mitad',
                    sub: Number(monto) > 0 ? money(parteIgual(Number(monto), 1, monedaEvento), monedaEvento) : undefined,
                  },
                  { value: 'OTRO', label: 'Otro monto' },
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
                options={otrosMiembros.map((x) => ({ value: x.usuarioId, label: x.nombre }))}
              />
              {compartidoCon.length > 0 && Number(monto) > 0 ? (
                <Nota>{`Partes iguales: ${money(parte, monedaEvento)} cada uno.`}</Nota>
              ) : null}
            </>
          )}
          {errParte && (reparto === 'OTRO' ? !!parteOtro : true) ? (
            <ErrorText>{errParte}</ErrorText>
          ) : (
            <Nota>{`Le pedimos su parte a ${nombresCompartido || 'tu hogar'} y te la transfiere. Lo ves en la pestaña Hogar.`}</Nota>
          )}
        </BloquePaso>
      )}

      {pPersona && (
        <BloquePaso paso={pPersona} style={styles.group}>
          <Elegir
            label="¿Quién?"
            paso={pPersona}
            placeholder="Elegir persona"
            value={persona}
            options={[
              ...opcionesP.map((x) => ({
                value: x.nombre,
                label: x.nombre,
                sub: saldoTexto(x.nombre, x.saldo, monedaEvento, money),
              })),
              { value: NUEVA, label: '+ Nueva persona' },
            ]}
            onChange={(v) => {
              setPersona(v);
              setPrevio(null);
              setIngresoId(null);
            }}
          />
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
        <Elegir
          label={`¿${nombrePersona} te había pasado plata antes?`}
          paso={pPrevio}
          placeholder="Elegir"
          value={previo}
          options={[
            { value: 'DEVOLVER', label: 'No, me la va a devolver' },
            { value: 'ANOTADA', label: 'Sí, y la anoté como mía', sub: 'Corregimos ese ingreso' },
            { value: 'NO_ANOTADA', label: 'Sí, pero no la anoté' },
          ]}
          onChange={(v) => {
            setPrevio(v as Previo | null);
            setIngresoId(null);
          }}
        />
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
            options={opcionesDeElementos(cuentasRecibe)}
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

      {necesitaDestino && (
        <Elegir
          label={tipo === 'INGRESO' ? '¿A qué cuenta llegó?' : '¿A qué cuenta?'}
          paso={pA}
          placeholder="Elegir cuenta"
          value={destinoId}
          options={opcionesA}
          onChange={setDestinoId}
        />
      )}

      {pCategoria && (
        <BloquePaso paso={pCategoria} style={styles.group}>
          <Elegir
            label="¿De qué tipo? (opcional)"
            paso={pCategoria}
            opcionNula="Sin categoría"
            value={categoriaId}
            options={categoriasAplicables.map((x) => ({
              value: x.id,
              label: x.categoriaPadreId ? `›  ${x.nombre}` : x.nombre,
            }))}
            onChange={setCategoriaId}
          />
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
                <Button title="Crear" variant="secondary" onPress={crearCategoriaInline} loading={catBusy} disabled={!catNombre.trim()} />
                <LinkButton title="Cancelar" onPress={() => setCrearCat(false)} />
              </View>
            </View>
          ) : (
            <LinkButton title="+ Nueva categoría" onPress={() => setCrearCat(true)} />
          )}
        </BloquePaso>
      )}

      <Cuando value={fecha} onChange={setFecha} paso={pFecha} />

      <Opcional titulo="Agregar detalle" abierto={!!glosa}>
        <Field
          label="Detalle (opcional)"
          value={glosa}
          onChangeText={setGlosa}
          placeholder="p. ej. pago internet marzo"
          autoCapitalize="sentences"
          maxLength={140}
        />
      </Opcional>

      {repiteAplica && (
        <Opcional titulo="Se repite cada mes o año" abierto={repite !== 'NO'}>
          <Elegir
            label="¿Se repite?"
            value={repite}
            options={OPCIONES_REPITE}
            onChange={(v) => setRepite((v as 'NO' | Periodicidad | null) ?? 'NO')}
          />
        </Opcional>
      )}

      {etiquetas.length > 0 && (
        <Opcional titulo="Agregar etiquetas" abierto={etiquetaIds.length > 0}>
          <ElegirVarios
            label="Etiquetas (opcional)"
            values={etiquetaIds}
            onChange={setEtiquetaIds}
            options={etiquetas.map((e) => ({ value: e.id, label: e.nombre }))}
          />
        </Opcional>
      )}

      {errMismo ? <ErrorText>{errMismo}</ErrorText> : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
