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
import {
  Ayuda,
  Button,
  DateField,
  ErrorText,
  Field,
  LinkButton,
  MoneyField,
  Nota,
  Pasos,
  Paragraph,
  Screen,
  Segmented,
  Select,
  Title,
  useC,
  type Paleta,
} from '../ui';
import {
  etiqueta,
  MONEDAS_FRECUENTES,
  NOMBRE_MONEDA,
  TIPOS_ELEMENTO_SUGERIDOS,
} from '../labels';

const CATEGORIAS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const;
const OPC_CATEGORIA = CATEGORIAS.map((c) => ({ value: c, label: etiqueta(c) }));
const OPC_TIPO_FALLBACK = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({ value: etiqueta(t), label: etiqueta(t) }));
const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));

/** Solo dígitos, máx 2 decimales, en [0, 100]. */
function limpiarPct(t: string): string {
  let s = t.replace(',', '.').replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
  if (Number(s) > 100) s = '100';
  return s;
}

export function AgregarElementoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('LIQUIDEZ');
  const [tiposCat, setTiposCat] = useState<TipoElementoDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [crearTipo, setCrearTipo] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState('');
  const [tipoBusy, setTipoBusy] = useState(false);
  const [valorInicial, setValorInicial] = useState('0');
  const [valorPendiente, setValorPendiente] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [cuota, setCuota] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [fechaAlta, setFechaAlta] = useState('');
  const [valorizable, setValorizable] = useState<'No' | 'Sí'>('No');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Paso actual del wizard y qué pasos ya intentó avanzar (para mostrar errores).
  const [paso, setPaso] = useState(1);
  const [intentado, setIntentado] = useState<Record<number, boolean>>({});

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

  const opcTipo =
    tiposCat.length > 0
      ? tiposCat.map((t) => ({ value: t.nombre, label: t.nombre }))
      : OPC_TIPO_FALLBACK;

  const elegirTipo = (v: string) => {
    setTipo(v);
    const t = tiposCat.find((x) => x.nombre === v);
    if (t?.categoriaSugerida) {
      setCategoria(t.categoriaSugerida);
      setValorizable(t.categoriaSugerida === 'ACTIVO' || t.categoriaSugerida === 'INVERSION' ? 'Sí' : 'No');
    }
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

  const hayComiembros = miembros.some((m) => m.usuarioId !== usuario.id);
  const compartida = propiedad === 'Compartida' && hayComiembros;
  const totalPasos = hayComiembros ? 3 : 2;

  const pctDe = (id: string) => Number(pcts[id] || 0);
  const propietarios = miembros
    .map((m) => ({ usuarioId: m.usuarioId, porcentaje: pctDe(m.usuarioId) }))
    .filter((p) => p.porcentaje > 0);
  const totalPct = propietarios.reduce((s, p) => s + p.porcentaje, 0);

  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';
  const sucio =
    nombre.trim().length > 0 ||
    tipo !== '' ||
    categoria !== 'LIQUIDEZ' ||
    valorInicial !== '0' ||
    valorPendiente !== '' ||
    contraparte !== '' ||
    fechaTermino !== '' ||
    cuota !== '' ||
    moneda !== 'CLP' ||
    fechaAlta !== '' ||
    propiedad !== 'Solo mía';
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  // ── Validación por paso ───────────────────────────────────────────────────
  const errNombre = nombre.trim() ? '' : 'Escribe un nombre para identificarlo.';
  const errTipo = tipo.trim() ? '' : 'Elige o escribe un tipo.';
  const errMoneda = /^[A-Za-z]{3}$/.test(moneda.trim())
    ? ''
    : 'Usa el código de 3 letras (CLP, USD, EUR…).';
  const errPendiente =
    esDeudaOCredito && !(Number(valorPendiente) > 0)
      ? categoria === 'DEUDA'
        ? 'Indica cuánto debes.'
        : 'Indica cuánto te deben.'
      : '';
  const errReparto = !compartida
    ? ''
    : Math.abs(totalPct - 100) > 0.001
      ? `Los porcentajes tienen que sumar 100% (van ${Math.round(totalPct * 100) / 100}%).`
      : pctDe(usuario.id) <= 0
        ? 'Tienes que quedar con al menos un 1%.'
        : propietarios.length < 2
          ? 'Agrega al menos otra persona con un porcentaje.'
          : '';

  const errorDelPaso = (p: number) =>
    p === 1 ? errNombre || errTipo : p === 2 ? errMoneda || errPendiente : errReparto;
  const mostrar = (p: number, msg: string) => (intentado[p] && msg ? msg : undefined);

  const avanzar = () => {
    setIntentado((x) => ({ ...x, [paso]: true }));
    if (errorDelPaso(paso)) return;
    setPaso((p) => Math.min(totalPasos, p + 1));
  };

  const onPropiedad = (v: 'Solo mía' | 'Compartida') => {
    setPropiedad(v);
    if (v === 'Compartida' && Object.keys(pcts).length === 0) {
      setPcts({ [usuario.id]: '100' });
    }
  };

  const onSubmit = async () => {
    setIntentado((x) => ({ ...x, [paso]: true }));
    if (errNombre || errTipo || errMoneda || errPendiente || errReparto) return;
    setError('');
    setLoading(true);
    try {
      await api.comando<ElementoPatrimonialDTO>(
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
                valorPendiente: Number(valorPendiente) || 0,
                ...(contraparte.trim() ? { contraparte: contraparte.trim() } : {}),
                ...(fechaTermino.trim() ? { fechaTermino: fechaTermino.trim() } : {}),
                ...(Number(cuota) > 0 ? { cuotaMonto: Number(cuota) } : {}),
              }
            : {
                valorInicial: Number(valorInicial) || 0,
                participaValorLiquido: categoria === 'LIQUIDEZ',
                admiteValorizacion: valorizable === 'Sí',
              }),
        },
        token,
        key,
      );
      toast.mostrar('Elemento agregado');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const esUltimo = paso === totalPasos;

  return (
    <Screen>
      <Title>Agregar cuenta o bien</Title>
      <Pasos actual={paso} total={totalPasos} />

      {paso === 1 && (
        <>
          <Select
            label="Tipo"
            value={tipo}
            options={opcTipo}
            onChange={elegirTipo}
            permiteOtro
          />
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
            <LinkButton
              title="¿No encuentras el tipo? Crear uno nuevo"
              onPress={() => setCrearTipo(true)}
            />
          ) : null}
          {intentado[1] && errTipo ? <ErrorText>{errTipo}</ErrorText> : null}
          <Select
            label="¿Qué es?"
            value={categoria}
            options={OPC_CATEGORIA}
            onChange={(c) => {
              setCategoria(c as (typeof CATEGORIAS)[number]);
              setValorizable(c === 'ACTIVO' || c === 'INVERSION' ? 'Sí' : 'No');
            }}
          />
          <Ayuda>
            {categoria === 'LIQUIDEZ'
              ? 'Liquidez: efectivo y cuentas de uso diario.'
              : categoria === 'RESERVA'
                ? 'Reserva: fondo de emergencia, plata que guardas pero no gastas.'
                : categoria === 'INVERSION'
                  ? 'Inversión: fondos mutuos, APV, acciones, depósitos a plazo.'
                  : categoria === 'ACTIVO'
                    ? 'Activo: bienes como un inmueble o un vehículo.'
                    : categoria === 'DEUDA'
                      ? 'Deuda: lo que debes (un crédito, un préstamo). Resta a tu patrimonio.'
                      : 'Crédito por cobrar: lo que alguien te debe. Suma a tu patrimonio.'}
          </Ayuda>
          <Field
            label="Nombre"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Cuenta corriente"
            autoCapitalize="sentences"
            error={mostrar(1, errNombre)}
          />
        </>
      )}

      {paso === 2 && (
        <>
          <Select
            label="Moneda"
            value={moneda}
            options={OPC_MONEDA}
            onChange={setMoneda}
            permiteOtro
          />
          {intentado[2] && errMoneda ? <ErrorText>{errMoneda}</ErrorText> : null}
          <DateField
            label="¿Desde cuándo lo tienes? (opcional)"
            value={fechaAlta}
            onChange={setFechaAlta}
            optional
          />
          {esDeudaOCredito ? (
            <>
              <MoneyField
                label={categoria === 'DEUDA' ? 'Monto que debes' : 'Monto que te deben'}
                value={valorPendiente}
                onChange={setValorPendiente}
                moneda={moneda.trim().toUpperCase() || undefined}
                error={mostrar(2, errPendiente)}
              />
              <Paragraph>
                {categoria === 'DEUDA'
                  ? 'Resta a tu patrimonio. Se salda con transferencias hacia esta deuda.'
                  : 'Suma a tu patrimonio. Se reduce cuando te pagan (transferencia hacia esta cuenta).'}
              </Paragraph>
              <Field
                label={categoria === 'DEUDA' ? 'Acreedor (opcional)' : 'Deudor (opcional)'}
                value={contraparte}
                onChangeText={setContraparte}
                autoCapitalize="sentences"
                placeholder={categoria === 'DEUDA' ? 'Banco, persona…' : 'A quién le prestaste'}
              />
              <DateField
                label="Fecha de término (opcional)"
                value={fechaTermino}
                onChange={setFechaTermino}
                optional
              />
              <MoneyField label="Cuota (opcional)" value={cuota} onChange={setCuota} moneda={moneda.trim().toUpperCase() || undefined} />
            </>
          ) : (
            <>
              <MoneyField
                label="Valor inicial"
                value={valorInicial}
                onChange={setValorInicial}
                moneda={moneda.trim().toUpperCase() || undefined}
              />
              <Segmented
                label="¿Se valoriza en el tiempo? (inmuebles, inversiones)"
                options={['No', 'Sí'] as const}
                value={valorizable}
                onChange={setValorizable}
              />
              <Paragraph>No se puede cambiar después de crear el elemento.</Paragraph>
            </>
          )}
        </>
      )}

      {paso === 3 && (
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
                      onChangeText={(t) =>
                        setPcts((p) => ({ ...p, [m.usuarioId]: limpiarPct(t) }))
                      }
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
              {intentado[3] && errReparto ? <ErrorText>{errReparto}</ErrorText> : null}
            </View>
          ) : (
            <Nota>Quedas como propietario al 100%.</Nota>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>

      <View style={styles.pie}>
        {esUltimo ? (
          <Button title="Agregar" onPress={onSubmit} loading={loading} />
        ) : (
          <Button title="Siguiente" onPress={avanzar} />
        )}
        {paso > 1 ? (
          <View style={styles.atras}>
            <LinkButton title="← Atrás" onPress={() => setPaso((p) => p - 1)} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  reparto: { gap: 10 },
  filaPct: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontSize: 14, color: c.text },
  pctInput: { width: 76 },
  pctSigno: { fontSize: 15, color: c.muted, fontWeight: '600' },
  total: { fontSize: 13, fontWeight: '700', color: c.muted, textAlign: 'right' },
  totalOk: { color: c.primary },
  pie: { gap: 10 },
  atras: { alignItems: 'center' },
});
