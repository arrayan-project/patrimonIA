import { useEffect, useMemo, useState } from 'react';
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
  ElegirVarios,
  BloquePaso,
  aISO,
  Button,
  Cuando,
  ErrorText,
  etiqueta,
  Field,
  LinkButton,
  Nota,
  Opcional,
  Skeleton,
  Screen,
  Segmented,
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

  // Resumen fijo abajo: una frase dice qué va a pasar (plantilla Formulario).
  const nombreDe = (id: string | null) =>
    [...elementos, ...elementosHogar].find((e) => e.id === id)?.nombre ?? '';
  const m = money(Number(monto) || 0, monedaEvento);
  const resumen: ReactNode = !puedeEnviar
    ? necesitaOrigen && necesitaDestino
      ? 'Completa monto, origen y destino.'
      : 'Completa monto y cuenta.'
    : tipo === 'GASTO'
      ? `Salen ${m} de ${nombreDe(origenId)}${meta ? `, de la plata de ${meta.nombre}` : ''}.`
      : tipo === 'INGRESO'
        ? `Entran ${m} a ${nombreDe(destinoId)}.`
        : tipo === 'TRANSFERENCIA'
          ? `Pasas ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)}. No cuenta como gasto.`
          : `Cambias ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)} al tipo de cambio vigente.`;
  const accion = {
    GASTO: 'Registrar gasto',
    INGRESO: 'Registrar ingreso',
    TRANSFERENCIA: 'Registrar transferencia',
    CONVERSION: 'Registrar cambio de moneda',
  }[tipo];

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca
  // el paso actual. La fecha ya trae valor (hoy), así que cuenta como hecha.
  const paso = contadorPasos();
  const pMonto = paso({ hecho: Number(monto) > 0 });
  const pDesde = necesitaOrigen ? paso({ hecho: !!origenId }) : undefined;
  const pMeta = tipo === 'GASTO' && metasCuenta.length > 0 ? paso({ opcional: true }) : undefined;
  const pA = necesitaDestino ? paso({ hecho: !!destinoId }) : undefined;
  const pCategoria = puedeCategorizar ? paso({ opcional: true }) : undefined;
  const pFecha = paso({ hecho: !!fecha });
  return (
    <Screen
      pie={
        <>
          <Nota>{resumen}</Nota>
          <Button title={accion} onPress={onSubmit} loading={loading} disabled={!puedeEnviar} />
        </>
      }
    >
      {plantillas.length > 0 && (
        <Elegir
          label="¿Usar una plantilla? (opcional)"
          placeholder="Elegir una plantilla"
          value={null}
          options={plantillas.map((p) => ({
            value: p.id,
            label: p.nombre,
            sub: p.monto != null ? money(p.monto, p.moneda ?? 'CLP') : undefined,
          }))}
          onChange={(id) => {
            const p = plantillas.find((x) => x.id === id);
            if (p) aplicarPlantilla(p);
          }}
        />
      )}

      <Segmented
        options={new Set(elementos.map((e) => e.moneda)).size > 1 || tipo === 'CONVERSION' ? TIPOS : TIPOS.slice(0, 3)}
        value={tipo}
        onChange={setTipo}
      />
      {tipo === 'CONVERSION' && (
        <Nota>El monto va en la moneda de la cuenta de salida; la otra recibe el equivalente al tipo de cambio vigente.</Nota>
      )}
      {tipo === 'INGRESO' && (
        <LinkButton
          title="¿Te la van a devolver o es de otra persona? Anótala como crédito o deuda"
          onPress={() => nav.go('AgregarElemento', { categoria: 'CREDITO' })}
        />
      )}

      <AmountInput label="¿Cuánto?" paso={pMonto} value={monto} onChange={setMonto} moneda={monedaEvento} />

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

      {puedeCategorizar && (
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
