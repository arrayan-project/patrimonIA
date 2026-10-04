import { useMemo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
  type TipoElementoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import { money } from '../format';
import {
  altaPorDefecto,
  aplicarNivel,
  NIVEL_POR_DEFECTO,
  opcionesNivel,
  type NivelHogar,
} from '../compartirHogar';
import {
  AmountInput,
  Ayuda,
  Button,
  contadorPasos,
  DateField,
  Elegir,
  ErrorText,
  Field,
  LinkButton,
  MoneyField,
  Nota,
  Panel,
  Row,
  Screen,
  Segmented,
  Select,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';
import {
  etiqueta,
  MONEDAS_FRECUENTES,
  NOMBRE_MONEDA,
  TIPOS_ELEMENTO_SUGERIDOS,
} from '../labels';

const CATEGORIAS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const;
type Categoria = (typeof CATEGORIAS)[number];
const OPC_CATEGORIA = CATEGORIAS.map((c) => ({ value: c, label: etiqueta(c) }));
const OPC_TIPO_FALLBACK = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({ value: etiqueta(t), label: etiqueta(t) }));
const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));
const valorizaPorDefecto = (c: Categoria) => (c === 'ACTIVO' || c === 'INVERSION' ? 'Sí' : 'No');

/** Solo dígitos, máx 2 decimales, en [0, 100]. */
function limpiarPct(t: string): string {
  let s = t.replace(',', '.').replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
  if (Number(s) > 100) s = '100';
  return s;
}

/**
 * G33 bloque 6 — C1 (HZ-9): una sola pantalla con tres datos (nombre, tipo y
 * saldo de hoy, obligatorio y sin 0 por defecto); lo demás tiene valores por
 * defecto y queda en "Más opciones". D-2: la pregunta del hogar aparece después
 * de crear; si se omite, queda en "Que puedan transferirte".
 */
export function AgregarElementoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const catInicial = CATEGORIAS.includes(nav.route.params?.categoria as Categoria)
    ? (nav.route.params?.categoria as Categoria)
    : 'LIQUIDEZ';

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [categoria, setCategoria] = useState<Categoria>(catInicial);
  const [cambiarCat, setCambiarCat] = useState(false);
  const mensaje = nav.route.params?.mensaje as string | undefined;
  const [tiposCat, setTiposCat] = useState<TipoElementoDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [crearTipo, setCrearTipo] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState('');
  const [tipoBusy, setTipoBusy] = useState(false);
  const [monto, setMonto] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [cuota, setCuota] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [fechaAlta, setFechaAlta] = useState('');
  const [valorizable, setValorizable] = useState<'No' | 'Sí'>(valorizaPorDefecto(catInicial));
  const [naturaleza, setNaturaleza] = useState<'Financiera' | 'Encargo o custodia'>('Financiera');
  const [masOpciones, setMasOpciones] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);

  // D-2: tras crear, la pregunta del hogar.
  const [creado, setCreado] = useState<ElementoPatrimonialDTO | null>(null);
  const [nivel, setNivel] = useState<NivelHogar>(NIVEL_POR_DEFECTO);

  // ── Co-propietarios (B8) ──────────────────────────────────────────────────
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [propiedad, setPropiedad] = useState<'Solo mía' | 'Compartida'>('Solo mía');
  const [pcts, setPcts] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then(async (hs) => {
        const h0 = hs[0]?.id ?? null;
        setHogarId(h0);
        if (!h0) return;
        const [h, tipos] = await Promise.all([
          api.get<HogarDTO>(`/hogares/${h0}`, token),
          api.get<TipoElementoDTO[]>(`/hogares/${h0}/tipos-elemento`, token).catch(() => []),
        ]);
        setMiembros(h?.miembros ?? []);
        setTiposCat(tipos);
      })
      .catch(() => setMiembros([]));
  }, [token]);

  // Agrupados por categoría, en el orden del catálogo.
  const opcTipo =
    tiposCat.length > 0
      ? tiposCat.map((t) => ({
          value: t.nombre,
          label: t.nombre,
          grupo: t.categoriaSugerida ? etiqueta(t.categoriaSugerida) : 'Otros',
        }))
      : OPC_TIPO_FALLBACK;

  const elegirCategoria = (cat: Categoria) => {
    setCategoria(cat);
    setValorizable(valorizaPorDefecto(cat));
  };

  const elegirTipo = (v: string) => {
    setTipo(v);
    setCambiarCat(false);
    const t = tiposCat.find((x) => x.nombre === v);
    if (t?.categoriaSugerida) elegirCategoria(t.categoriaSugerida);
  };

  const crearTipoInline = async () => {
    if (!hogarId || !tipoNuevo.trim()) return;
    setTipoBusy(true);
    setError('');
    try {
      const nuevo = await api.post<TipoElementoDTO>(
        '/comandos/CrearTipoElemento',
        { hogarId, nombre: tipoNuevo.trim(), categoriaSugerida: categoria },
        token,
      );
      setTiposCat(await api.get<TipoElementoDTO[]>(`/hogares/${hogarId}/tipos-elemento`, token));
      setTipo(nuevo.nombre);
      setTipoNuevo('');
      setCrearTipo(false);
      toast.mostrar('Tipo creado');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setTipoBusy(false);
    }
  };

  const otros = miembros.filter((m) => m.usuarioId !== usuario.id);
  const hayComiembros = otros.length > 0;
  const compartida = propiedad === 'Compartida' && hayComiembros;

  const pctDe = (id: string) => Number(pcts[id] || 0);
  const propietarios = miembros
    .map((m) => ({ usuarioId: m.usuarioId, porcentaje: pctDe(m.usuarioId) }))
    .filter((p) => p.porcentaje > 0);
  const totalPct = propietarios.reduce((s, p) => s + p.porcentaje, 0);

  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';
  // C2: una tarjeta de crédito siempre es financiera; no se pregunta.
  const esTarjeta = categoria === 'DEUDA' && tipo.trim().toLowerCase() === 'tarjeta de crédito';
  const sucio =
    !creado &&
    (nombre.trim().length > 0 ||
      tipo !== '' ||
      monto !== '' ||
      contraparte !== '' ||
      fechaTermino !== '' ||
      cuota !== '' ||
      moneda !== 'CLP' ||
      fechaAlta !== '' ||
      propiedad !== 'Solo mía' ||
      naturaleza !== 'Financiera');
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  // ── Validación ────────────────────────────────────────────────────────────
  const errNombre = nombre.trim() ? '' : 'Escribe un nombre para identificarla.';
  const errTipo = tipo.trim() ? '' : 'Elige qué tipo es.';
  const errMonto = esDeudaOCredito
    ? Number(monto) > 0
      ? ''
      : categoria === 'DEUDA'
        ? 'Indica cuánto debes.'
        : 'Indica cuánto te deben.'
    : monto === ''
      ? 'Escribe cuánto tiene hoy. Si está vacía, escribe 0.'
      : '';
  const errMoneda = /^[A-Za-z]{3}$/.test(moneda.trim())
    ? ''
    : 'Usa el código de 3 letras (CLP, USD, EUR…).';
  const errReparto = !compartida
    ? ''
    : Math.abs(totalPct - 100) > 0.001
      ? `Los porcentajes tienen que sumar 100% (van ${Math.round(totalPct * 100) / 100}%).`
      : pctDe(usuario.id) <= 0
        ? 'Tienes que quedar con al menos un 1%.'
        : propietarios.length < 2
          ? 'Agrega al menos otra persona con un porcentaje.'
          : '';
  const mostrar = (msg: string) => (intento && msg ? msg : undefined);

  const onPropiedad = (v: 'Solo mía' | 'Compartida') => {
    setPropiedad(v);
    if (v === 'Compartida' && Object.keys(pcts).length === 0) {
      setPcts({ [usuario.id]: '100' });
    }
  };

  const onSubmit = async () => {
    setIntento(true);
    if (errNombre || errTipo || errMonto) return;
    // Los errores de "Más opciones" se muestran ahí; se abre si hay alguno.
    if (errMoneda || errReparto) {
      setMasOpciones(true);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const el = await api.comando<ElementoPatrimonialDTO>(
        '/comandos/RegistrarElementoPatrimonial',
        {
          nombre: nombre.trim(),
          tipo: tipo.trim(),
          categoriaFuncional: categoria,
          moneda: moneda.trim().toUpperCase(),
          ...(fechaAlta.trim() ? { fechaAlta: fechaAlta.trim() } : {}),
          ...(compartida && propietarios.length > 1 ? { propietarios } : {}),
          ...(esDeudaOCredito
            ? {
                valorPendiente: Number(monto) || 0,
                naturaleza:
                  naturaleza === 'Encargo o custodia' && !esTarjeta ? 'CUSTODIA_INFORMAL' : 'FINANCIERA',
                ...(contraparte.trim() ? { contraparte: contraparte.trim() } : {}),
                ...(fechaTermino.trim() ? { fechaTermino: fechaTermino.trim() } : {}),
                ...(Number(cuota) > 0 ? { cuotaMonto: Number(cuota) } : {}),
              }
            : {
                valorInicial: Number(monto) || 0,
                participaValorLiquido: categoria === 'LIQUIDEZ',
                admiteValorizacion: valorizable === 'Sí',
              }),
          ...altaPorDefecto(),
        },
        token,
        key,
      );
      permitirSalida();
      if (hayComiembros) {
        setCreado(el);
      } else {
        toast.mostrar(`${el.nombre} quedó agregada`);
        nav.back();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const guardarNivel = async () => {
    if (!creado) return;
    if (nivel === NIVEL_POR_DEFECTO) {
      toast.mostrar('Guardado');
      nav.back();
      return;
    }
    setError('');
    setLoading(true);
    try {
      await aplicarNivel(token, creado.id, nivel, creado.participaConsolidacion);
      toast.mostrar('Guardado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // ── Paso 2 (D-2): ¿qué compartes con el hogar? ────────────────────────────
  if (creado) {
    const pareja = otros.length === 1 ? otros[0].nombre : undefined;
    const valor = creado.valorPendiente ?? creado.valorVigente;
    return (
      <Screen
        pie={
          <>
            <Button title="Guardar" onPress={guardarNivel} loading={loading} />
            <Button title="Ahora no" variant="secondary" onPress={() => nav.back()} />
          </>
        }
      >
        <Panel>
          <Text style={styles.listo}>✓ {creado.nombre} quedó agregada</Text>
          <Text style={styles.muted}>
            {creado.categoriaFuncional === 'DEUDA' ? 'Debes' : creado.categoriaFuncional === 'CREDITO' ? 'Te deben' : 'Tiene'}{' '}
            {money(valor, creado.moneda)}.
          </Text>
        </Panel>
        <Elegir
          label={`¿Qué compartes de ${creado.nombre} con ${pareja ?? 'el hogar'}?`}
          value={nivel}
          options={opcionesNivel(pareja)}
          onChange={(v) => v && setNivel(v as NivelHogar)}
        />
        <Nota>Puedes cambiarlo cuando quieras desde la cuenta.</Nota>
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  const categoriaResuelta =
    !cambiarCat && tiposCat.find((x) => x.nombre === tipo)?.categoriaSugerida === categoria;
  const monedaVista = moneda.trim().toUpperCase() || undefined;

  // HZ-19 y HZ-24: numera las preguntas y marca el paso actual.
  const paso = contadorPasos();
  const pNombre = paso({ hecho: !!nombre.trim() });
  const pTipo = paso({ hecho: !!tipo.trim() });
  const pMonto = paso({ hecho: !errMonto });

  const agregar =
    categoria === 'DEUDA' ? 'Agregar deuda' : categoria === 'CREDITO' ? 'Agregar crédito' : categoria === 'ACTIVO' ? 'Agregar bien' : 'Agregar cuenta';
  return (
    <Screen
      pie={
        <Button title={agregar} onPress={onSubmit} loading={loading} disabled={!!(errNombre || errTipo || errMonto)} />
      }
    >
      {mensaje ? <Ayuda>{mensaje}</Ayuda> : null}

      <Field
        label="¿Cómo se llama?"
        paso={pNombre}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej: Falabella"
        autoCapitalize="sentences"
        error={mostrar(errNombre)}
      />

      <Select
        label="¿Qué tipo es?"
        paso={pTipo}
        placeholder="Elegir tipo"
        value={tipo}
        options={opcTipo}
        onChange={elegirTipo}
        permiteOtro
      />
      {mostrar(errTipo) ? <ErrorText>{errTipo}</ErrorText> : null}
      {crearTipo ? (
        <View style={{ gap: 8 }}>
          <Field
            label="Nombre del tipo"
            value={tipoNuevo}
            onChangeText={setTipoNuevo}
            autoCapitalize="sentences"
            placeholder="p. ej. Billetera digital"
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Crear" onPress={crearTipoInline} loading={tipoBusy} disabled={!tipoNuevo.trim()} />
            <LinkButton title="Cancelar" onPress={() => setCrearTipo(false)} />
          </View>
        </View>
      ) : hogarId ? (
        <LinkButton title="¿No encuentras el tipo? Crear uno nuevo" onPress={() => setCrearTipo(true)} />
      ) : null}
      {/* G32 H-09 — si el tipo ya sugiere la categoría, se muestra resuelta. */}
      {tipo ? (
        categoriaResuelta ? (
          <Row
            left={`Categoría: ${etiqueta(categoria)}`}
            right={<LinkButton title="Cambiar" onPress={() => setCambiarCat(true)} />}
          />
        ) : (
          <Select
            label="¿Qué es?"
            value={categoria}
            options={OPC_CATEGORIA}
            onChange={(v) => elegirCategoria(v as Categoria)}
          />
        )
      ) : null}

      <AmountInput
        label={
          categoria === 'DEUDA'
            ? '¿Cuánto debes hoy?'
            : categoria === 'CREDITO'
              ? '¿Cuánto te deben hoy?'
              : categoria === 'ACTIVO'
                ? '¿Cuánto vale hoy?'
                : '¿Cuánto tiene hoy?'
        }
        paso={pMonto}
        value={monto}
        onChange={setMonto}
        moneda={monedaVista}
        error={mostrar(errMonto)}
      />
      <Nota>
        {categoria === 'DEUDA'
          ? 'Lo que debes a la fecha, según tu estado de cuenta o la app del banco.'
          : categoria === 'CREDITO'
            ? 'Lo que te deben a la fecha. Se reduce cuando te pagan.'
            : categoria === 'ACTIVO'
              ? 'Lo que vale hoy, aproximado.'
              : 'El saldo que ves hoy en la app de tu banco.'}
      </Nota>

      {esDeudaOCredito && !esTarjeta && (
        <>
          <Segmented
            label="¿Qué tipo es?"
            options={['Financiera', 'Encargo o custodia'] as const}
            value={naturaleza}
            onChange={setNaturaleza}
            formatearOpcion={(v) => v}
          />
          <Ayuda>
            {naturaleza === 'Encargo o custodia'
              ? 'Encargo: plata que solo pasa por tus cuentas para comprarle algo a alguien. No es tuya ni la debes de verdad — la app la muestra aparte de las deudas financieras.'
              : 'Financiera: un crédito real, un préstamo entre personas, el saldo de una tarjeta.'}
          </Ayuda>
        </>
      )}

      <LinkButton
        title={masOpciones ? 'Ocultar más opciones' : 'Más opciones (moneda, fecha, propietarios…)'}
        onPress={() => setMasOpciones((x) => !x)}
      />
      {masOpciones && (
        <Panel>
          <Select
            label="¿En qué moneda está?"
            value={moneda}
            options={OPC_MONEDA}
            onChange={setMoneda}
            permiteOtro
          />
          {mostrar(errMoneda) ? <ErrorText>{errMoneda}</ErrorText> : null}
          <DateField label="¿Desde cuándo la tienes? (opcional)" value={fechaAlta} onChange={setFechaAlta} optional />
          {esDeudaOCredito ? (
            <>
              <Field
                label={categoria === 'DEUDA' ? '¿A quién le debes? (opcional)' : '¿Quién te debe? (opcional)'}
                value={contraparte}
                onChangeText={setContraparte}
                autoCapitalize="sentences"
                placeholder={categoria === 'DEUDA' ? 'Banco, persona…' : 'A quién le prestaste'}
              />
              <DateField label="¿Hasta cuándo? (opcional)" value={fechaTermino} onChange={setFechaTermino} optional />
              <MoneyField label="¿De cuánto es la cuota? (opcional)" value={cuota} onChange={setCuota} />
            </>
          ) : (
            <Segmented
              label="¿Se valoriza en el tiempo? (inmuebles, inversiones)"
              options={['No', 'Sí'] as const}
              value={valorizable}
              onChange={setValorizable}
            />
          )}
          {hayComiembros && (
            <>
              <Segmented
                label="¿De quién es?"
                options={['Solo mía', 'Compartida'] as const}
                value={propiedad}
                onChange={onPropiedad}
                formatearOpcion={(v) => v}
              />
              {compartida ? (
                <View style={styles.reparto}>
                  <Ayuda>
                    Reparte el 100% entre los propietarios. Cada uno verá su parte en su
                    patrimonio; el hogar la ve completa.
                  </Ayuda>
                  {miembros.map((m) => (
                    <View key={m.usuarioId} style={styles.filaPct}>
                      <Text style={styles.filaNombre} numberOfLines={1}>
                        {m.usuarioId === usuario.id ? `${m.nombre} (tú)` : m.nombre}
                      </Text>
                      <View style={styles.pctInput}>
                        <Field
                          label=""
                          value={pcts[m.usuarioId] ?? ''}
                          onChangeText={(t) => setPcts((p) => ({ ...p, [m.usuarioId]: limpiarPct(t) }))}
                          keyboardType="numeric"
                          placeholder="0"
                        />
                      </View>
                      <Text style={styles.pctSigno}>%</Text>
                    </View>
                  ))}
                  <Text style={[styles.total, Math.abs(totalPct - 100) < 0.001 && styles.totalOk]}>
                    Total: {Math.round(totalPct * 100) / 100}%
                  </Text>
                  {mostrar(errReparto) ? <ErrorText>{errReparto}</ErrorText> : null}
                </View>
              ) : null}
            </>
          )}
          <Nota>Si no lo tocas: pesos chilenos, desde hoy y solo tuya.</Nota>
        </Panel>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  listo: { fontSize: 18, fontWeight: '700', color: c.text },
  muted: tipoDe(c).nota,
  reparto: { gap: 10 },
  filaPct: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontSize: 14, color: c.text },
  pctInput: { width: 76 },
  pctSigno: { fontSize: 15, color: c.muted, fontWeight: '600' },
  total: { fontSize: 13, fontWeight: '700', color: c.muted, textAlign: 'right' },
  totalOk: { color: c.primary },
});
