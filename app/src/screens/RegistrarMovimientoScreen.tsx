import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { money } from '../format';
import { opcionesDeElementos, opcionesDeMiembros } from '../opciones';
import { useToast } from '../ui/Toast';
import {
  contadorPasos,
  AmountInput,
  Elegir,
  BloquePaso,
  Question,
  aISO,
  Button,
  Chip,
  DateField,
  ErrorText,
  Field,
  LinkButton,
  Nota,
  Skeleton,
  Screen,
  Segmented,
  useC,
  type Paleta,
} from '../ui';

const TIPOS = ['INGRESO', 'GASTO', 'TRANSFERENCIA', 'CONVERSION'] as const;
type Tipo = (typeof TIPOS)[number];

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
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
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
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [crearCat, setCrearCat] = useState(false);
  const [catNombre, setCatNombre] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [glosa, setGlosa] = useState('');
  // HZ-13: gastar la plata de una meta. Se puede llegar con la meta ya elegida.
  const objetivoInicial = (params.objetivoId as string | undefined) ?? null;
  const [metasCuenta, setMetasCuenta] = useState<MetaEnCuenta[]>([]);
  const [asignacionId, setAsignacionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);

  const sucio =
    Number(monto) > 0 ||
    origenId !== origenInicial ||
    destinoId !== destinoInicial ||
    glosa.trim() !== '' ||
    categoriaId !== null ||
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
        setHogarId(hs[0]?.id ?? null);
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
  }, [token]);

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

  // Si la cuenta vino preelegida y el usuario cambia a Ingreso, la plata entra a esa cuenta.
  useEffect(() => {
    if (cuentaId && tipo === 'INGRESO') setDestinoId((d) => d ?? cuentaId);
  }, [cuentaId, tipo]);

  const toggleEtiqueta = (id: string) =>
    setEtiquetaIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  const aplicarPlantilla = (p: PlantillaMovimientoDTO) => {
    if (p.tipo === 'INGRESO' || p.tipo === 'GASTO' || p.tipo === 'TRANSFERENCIA') setTipo(p.tipo);
    if (p.monto != null) setMonto(String(p.monto));
    if (p.elementoOrigenId) setOrigenId(p.elementoOrigenId);
    if (p.elementoDestinoId) setDestinoId(p.elementoDestinoId);
    setCategoriaId(p.categoriaId);
    setGlosa(p.glosa ?? '');
  };

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

  const meta = tipo === 'GASTO' ? metasCuenta.find((m) => m.asignacionId === asignacionId) : undefined;
  const cuentaOrigen = elementos?.find((e) => e.id === origenId);

  const onSubmit = async () => {
    setIntento(true);
    if (errMonto || errMismo || !puedeEnviar) return;
    setError('');
    setLoading(true);
    try {
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
      if (meta) {
        const resto = meta.objetivoId
          ? await api
              .get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${meta.objetivoId}`, token)
              .then((o) => `: ahora tiene ${money(o.progreso, o.moneda)}`)
              .catch(() => '')
          : '';
        toast.mostrar(`Salió de tu meta ${meta.nombre}${resto}`);
      } else {
        toast.mostrar('Movimiento registrado');
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
  const opcionesDesde = opcionesDeElementos(elementos);
  const opcionesA = [
    ...opcionesDeElementos(elementos, { excluir: origenId }),
    ...(tipo === 'TRANSFERENCIA'
      ? opcionesDeMiembros(elementosHogar.filter((e) => !propios.has(e.id)), { excluir: origenId })
      : []),
  ];

  const puedeEnviar =
    Number(monto) > 0 &&
    (!necesitaOrigen || !!origenId) &&
    (!necesitaDestino || !!destinoId) &&
    origenId !== destinoId;

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca
  // el paso actual. Tipo y Fecha ya traen valor, así que cuentan como hechos.
  const paso = contadorPasos();
  const pTipo = paso({ hecho: true });
  const pMonto = paso({ hecho: Number(monto) > 0 });
  const pFecha = paso({ hecho: !!fecha });
  const pDetalle = paso({ opcional: true });
  const pCategoria = puedeCategorizar ? paso({ opcional: true }) : undefined;
  const pDesde = necesitaOrigen ? paso({ hecho: !!origenId }) : undefined;
  const pMeta = tipo === 'GASTO' && metasCuenta.length > 0 ? paso({ opcional: true }) : undefined;
  const pA = necesitaDestino ? paso({ hecho: !!destinoId }) : undefined;
  const pEtiquetas = etiquetas.length > 0 ? paso({ opcional: true }) : undefined;
  return (
    <Screen>
      {plantillas.length > 0 ? (
        <View style={styles.group}>
          <Elegir
            label="Desde una plantilla"
            placeholder="Elegir una plantilla"
            value={null}
            options={plantillas.map((p) => ({
              value: p.id,
              label: p.monto != null ? `${p.nombre} · ${money(p.monto, p.moneda ?? 'CLP')}` : p.nombre,
            }))}
            onChange={(id) => {
              const p = plantillas.find((x) => x.id === id);
              if (p) aplicarPlantilla(p);
            }}
          />
          <LinkButton title="Gestionar plantillas" onPress={() => nav.go('Plantillas')} />
        </View>
      ) : (
        <LinkButton
          title="¿Registras siempre lo mismo? Crea una plantilla"
          onPress={() => nav.go('Plantillas')}
        />
      )}

      <Segmented label="¿Qué quieres anotar?" options={TIPOS} value={tipo} onChange={setTipo} paso={pTipo} />
      {tipo === 'CONVERSION' && (
        <Nota>
          Cambio de moneda: el monto va en la moneda de la cuenta de salida; la de llegada
          recibe el equivalente según el tipo de cambio vigente. Necesitas la tasa registrada.
        </Nota>
      )}
      {tipo === 'INGRESO' && (
        <View style={styles.hint}>
          <Nota>
            ¿Te van a devolver este dinero, o es de un tercero para comprarle algo? No lo
            registres como ingreso —se sumaría a tus ingresos del mes—. Créalo como un
            Crédito (te deben) o una Deuda tipo "encargo".
          </Nota>
          <LinkButton
            title="Crear un crédito o una deuda"
            onPress={() => nav.go('AgregarElemento', { categoria: 'CREDITO' })}
          />
        </View>
      )}
      {tipo === 'GASTO' && (
        <Nota>
          ¿Alguien más puso parte? Registra primero una transferencia desde su cuenta a la
          tuya y luego este gasto por el total: así queda el rastro de quién aportó cuánto.
        </Nota>
      )}
      <AmountInput
        label="¿Cuánto?"
        paso={pMonto}
        value={monto}
        onChange={setMonto}
        moneda={monedaEvento}
        error={intento ? errMonto : undefined}
      />
      <DateField label="¿Cuándo?" value={fecha} onChange={setFecha} paso={pFecha} />
      <Field
        label={`${tipo === 'GASTO' ? '¿En qué?' : tipo === 'INGRESO' ? '¿Qué fue?' : '¿Para qué?'} (opcional)`}
        paso={pDetalle}
        value={glosa}
        onChangeText={setGlosa}
        placeholder="p. ej. pago internet marzo"
        autoCapitalize="sentences"
        maxLength={140}
      />

      {puedeCategorizar && (
        <BloquePaso paso={pCategoria} style={styles.group}>
          <Elegir
            label="Categoría (opcional)"
            paso={pCategoria}
            opcionNula="Sin categoría"
            value={categoriaId}
            options={categoriasAplicables.map((c) => ({
              value: c.id,
              label: c.categoriaPadreId ? `›  ${c.nombre}` : c.nombre,
            }))}
            onChange={setCategoriaId}
          />
          {crearCat ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Field
                label="Nombre de la categoría"
                value={catNombre}
                onChangeText={setCatNombre}
                autoCapitalize="sentences"
                placeholder="p. ej. Mascotas"
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button title="Crear" onPress={crearCategoriaInline} loading={catBusy} disabled={!catNombre.trim()} />
                <LinkButton title="Cancelar" onPress={() => setCrearCat(false)} />
              </View>
            </View>
          ) : (
            <LinkButton
              title="¿No encuentras la categoría? Crear una nueva"
              onPress={() => setCrearCat(true)}
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
            label="¿Esta compra sale de una meta? (opcional)"
            paso={pMeta}
            opcionNula="No, de la plata libre"
            value={asignacionId}
            options={metasCuenta.map((m) => ({
              value: m.asignacionId,
              label: `${m.nombre} · ${money(m.monto, monedaEvento)}`,
            }))}
            onChange={setAsignacionId}
          />
          {meta && Number(monto) > meta.monto ? (
            <Nota>
              {`La meta ${meta.nombre} no cubre todo: en ${cuentaOrigen?.nombre ?? 'esta cuenta'} tiene ${money(meta.monto, monedaEvento)}. Se descontarán ${money(meta.monto, monedaEvento)} de la meta y ${money(Number(monto) - meta.monto, monedaEvento)} saldrán de lo libre de la cuenta. Si prefieres otra cosa, cambia la cuenta o el monto.`}
            </Nota>
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

      {etiquetas.length > 0 && (
        <BloquePaso paso={pEtiquetas} style={styles.group}>
          <Question paso={pEtiquetas}>Etiquetas (opcional)</Question>
          <View style={styles.chips}>
            {etiquetas.map((e) => (
              <Chip
                key={e.id}
                label={e.nombre}
                color={e.color}
                activo={etiquetaIds.includes(e.id)}
                onPress={() => toggleEtiqueta(e.id)}
              />
            ))}
          </View>
        </BloquePaso>
      )}

      {intento && errMismo ? <ErrorText>{errMismo}</ErrorText> : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Registrar" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  group: { gap: 8 },
  hint: { gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
