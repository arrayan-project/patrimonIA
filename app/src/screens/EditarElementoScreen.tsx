import { useMemo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  BloquePaso,
  Button,
  contadorPasos,
  DateField,
  ErrorText,
  Field,
  MoneyField,
  Nota,
  Opcional,
  Question,
  Screen,
  Select,
  Skeleton,
  useC,
  type Paleta,
} from '../ui';
import { etiqueta, TIPOS_ELEMENTO_SUGERIDOS } from '../labels';

const OPC_TIPO_FALLBACK = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({
  value: etiqueta(t),
  label: etiqueta(t),
}));

/** Solo dígitos, máx 2 decimales, en [0, 100]. */
function limpiarPct(t: string): string {
  let s = t.replace(',', '.').replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
  if (Number(s) > 100) s = '100';
  return s;
}

/**
 * Editar los datos de una cuenta o bien (plantillas de pantalla, R4b): nombre,
 * tipo, detalle de una deuda o crédito y propietarios, con un solo botón.
 * Lo que se comparte con el hogar vive en "Ajustes de la cuenta"
 * (AjustesElemento) y desactivar o eliminar, al final del Detalle.
 */
export function EditarElementoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;

  const [el, setEl] = useState<ElementoPatrimonialDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [motivoDato, setMotivoDato] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Propietarios (A3 — CambiarPropiedadElementoPatrimonial) ────────────────
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [tiposCat, setTiposCat] = useState<string[]>([]);
  const [pcts, setPcts] = useState<Record<string, string>>({});

  // ── Detalle de deuda/crédito (§B3) ────────────────────────────────────────
  const [contraparte, setContraparte] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [cuota, setCuota] = useState('');
  const [tasa, setTasa] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const propsEditados = Object.entries(pcts)
    .map(([usuarioId, v]) => ({ usuarioId, porcentaje: Number(v || 0) }))
    .filter((p) => p.porcentaje > 0);
  const firmaReparto = (arr: { usuarioId: string; porcentaje: number }[]) =>
    arr
      .map((p) => `${p.usuarioId}:${p.porcentaje}`)
      .sort()
      .join('|');
  const repartoCambiado =
    !!el &&
    firmaReparto(propsEditados) !==
      firmaReparto(el.propietarios.map((p) => ({ usuarioId: p.usuarioId, porcentaje: p.porcentaje })));

  const esDeudaOCredito =
    !!el && (el.categoriaFuncional === 'DEUDA' || el.categoriaFuncional === 'CREDITO');
  const detalleDto: Record<string, string | number> = {};
  if (el) {
    if (contraparte.trim() !== (el.contraparte ?? '')) detalleDto.contraparte = contraparte.trim();
    if (fechaInicio !== (el.fechaInicio ?? '')) detalleDto.fechaInicio = fechaInicio;
    if (fechaTermino !== (el.fechaTermino ?? '')) detalleDto.fechaTermino = fechaTermino;
    const cuotaOrig = el.cuotaMonto != null ? String(el.cuotaMonto) : '';
    if (cuota.trim() !== cuotaOrig && Number(cuota) > 0) detalleDto.cuotaMonto = Number(cuota);
    const tasaOrig = el.tasaInteres != null ? String(el.tasaInteres) : '';
    if (tasa.trim() !== tasaOrig && Number(tasa) >= 0 && tasa.trim() !== '')
      detalleDto.tasaInteres = Number(tasa);
    if (observaciones.trim() !== (el.observaciones ?? ''))
      detalleDto.observaciones = observaciones.trim();
  }
  const detalleCambiado = Object.keys(detalleDto).length > 0;
  const datosCambiados = !!el && (nombre.trim() !== el.nombre || tipo.trim() !== el.tipo);
  const corrigiendo = motivoDato.trim().length > 0;

  const sucio = datosCambiados || repartoCambiado || detalleCambiado || corrigiendo;
  const permitirSalida = useConfirmarDescarte(sucio && !busy);

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token)
      .then((e) => {
        setEl(e);
        setNombre(e.nombre);
        setTipo(e.tipo);
        setPcts(Object.fromEntries(e.propietarios.map((p) => [p.usuarioId, String(p.porcentaje)])));
        setContraparte(e.contraparte ?? '');
        setFechaInicio(e.fechaInicio ?? '');
        setFechaTermino(e.fechaTermino ?? '');
        setCuota(e.cuotaMonto != null ? String(e.cuotaMonto) : '');
        setTasa(e.tasaInteres != null ? String(e.tasaInteres) : '');
        setObservaciones(e.observaciones ?? '');
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [elementoId, token]);

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then(async (hs) => {
        const h0 = hs[0]?.id;
        if (!h0) return;
        const [h, tipos] = await Promise.all([
          api.get<HogarDTO>(`/hogares/${h0}`, token),
          api
            .get<{ nombre: string }[]>(`/hogares/${h0}/tipos-elemento`, token)
            .catch(() => [] as { nombre: string }[]),
        ]);
        setMiembros(h?.miembros ?? []);
        setTiposCat(tipos.map((t) => t.nombre));
      })
      .catch(() => setMiembros([]));
  }, [token]);

  const opcTipo = useMemo(() => {
    const base =
      tiposCat.length > 0 ? tiposCat.map((n) => ({ value: n, label: n })) : OPC_TIPO_FALLBACK;
    // asegura que el tipo actual del elemento aparezca aunque no esté en el catálogo
    return tipo && !base.some((o) => o.value === tipo)
      ? [{ value: tipo, label: tipo }, ...base]
      : base;
  }, [tiposCat, tipo]);

  useTitulo(el ? `Editar ${el.nombre}` : undefined);

  if (!el) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const personas = (() => {
    const map = new Map<string, string>();
    for (const p of el.propietarios) map.set(p.usuarioId, p.nombre ?? 'Propietario');
    for (const m of miembros) {
      map.set(m.usuarioId, m.usuarioId === usuario.id ? `${m.nombre} (tú)` : m.nombre);
    }
    return [...map.entries()].map(([usuarioId, nombre]) => ({ usuarioId, nombre }));
  })();
  const puedeEditarPropietarios = personas.length > 1;
  const totalPct = propsEditados.reduce((s, p) => s + p.porcentaje, 0);
  const errReparto =
    Math.abs(totalPct - 100) > 0.001
      ? `Los porcentajes tienen que sumar 100% (van ${Math.round(totalPct * 100) / 100}%).`
      : propsEditados.length === 0
        ? 'Asigna al menos un propietario.'
        : '';
  const esDeuda = el.categoriaFuncional === 'DEUDA';

  const listo =
    (datosCambiados || detalleCambiado || repartoCambiado) &&
    !!nombre.trim() &&
    (!repartoCambiado || !errReparto) &&
    (!corrigiendo || motivoDato.trim().length >= 3);

  const guardar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      if (datosCambiados) {
        // Corrección: el dato estaba mal desde el principio (queda en el historial con su motivo).
        if (corrigiendo)
          await api.post(
            '/comandos/CorregirDatosElementoPatrimonial',
            { elementoId, nombre: nombre.trim(), tipo: tipo.trim(), motivo: motivoDato.trim() },
            token,
          );
        else
          await api.post(
            '/comandos/ActualizarDatosElementoPatrimonial',
            { elementoId, nombre: nombre.trim(), tipo: tipo.trim() },
            token,
          );
      }
      if (detalleCambiado)
        await api.post('/comandos/ActualizarDatosElementoPatrimonial', { elementoId, ...detalleDto }, token);
      if (repartoCambiado)
        await api.post(
          '/comandos/CambiarPropiedadElementoPatrimonial',
          { elementoId, propietarios: propsEditados },
          token,
        );
      toast.mostrar(corrigiendo && datosCambiados ? 'Corrección guardada' : 'Cambios guardados');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  // Los pasos se cuentan en el orden en que se muestran.
  const paso = contadorPasos();
  const pNombre = paso({ hecho: !!nombre.trim() });
  const pTipo = paso({ hecho: !!tipo });
  const pPropietarios = puedeEditarPropietarios ? paso({ hecho: !errReparto }) : undefined;
  return (
    <Screen
      pie={
        <>
          {repartoCambiado && errReparto ? <Nota>{errReparto}</Nota> : null}
          <Button title="Guardar cambios" onPress={guardar} loading={busy} disabled={!listo} />
        </>
      }
    >
      <Field
        label="¿Cómo se llama?"
        paso={pNombre}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="sentences"
      />
      <Select label="¿Qué tipo es?" paso={pTipo} value={tipo} options={opcTipo} onChange={setTipo} permiteOtro />

      {esDeudaOCredito && (
        <Opcional
          titulo={esDeuda ? 'Agregar detalle de la deuda' : 'Agregar detalle del crédito'}
          abierto={!!(el.contraparte || el.fechaInicio || el.fechaTermino || el.cuotaMonto != null || el.tasaInteres != null || el.observaciones)}
        >
          <Nota>Todo opcional. Sirve para seguir un crédito real (hipotecario, préstamo).</Nota>
          <Field
            label={esDeuda ? '¿A quién le debes? (opcional)' : '¿Quién te debe? (opcional)'}
            value={contraparte}
            onChangeText={setContraparte}
            autoCapitalize="sentences"
          />
          <DateField label="¿Desde cuándo? (opcional)" value={fechaInicio} onChange={setFechaInicio} optional />
          <DateField label="¿Hasta cuándo? (opcional)" value={fechaTermino} onChange={setFechaTermino} optional />
          <MoneyField label="¿De cuánto es la cuota? (opcional)" value={cuota} onChange={setCuota} />
          <Field label="¿Qué tasa anual tiene? (%, opcional)" value={tasa} onChangeText={setTasa} keyboardType="numeric" />
          <Field label="Notas (opcional)" value={observaciones} onChangeText={setObservaciones} autoCapitalize="sentences" />
        </Opcional>
      )}

      {pPropietarios && (
        <BloquePaso paso={pPropietarios} style={styles.grupo}>
          <Question paso={pPropietarios}>¿De quién es?</Question>
          <Nota>Reparte el 100%. Quien quede en 0% deja de ser propietario.</Nota>
          {personas.map((p) => (
            <View key={p.usuarioId} style={styles.filaPct}>
              <Text style={styles.filaNombre} numberOfLines={1}>
                {p.nombre}
              </Text>
              <View style={styles.pctInput}>
                <Field
                  label=""
                  value={pcts[p.usuarioId] ?? ''}
                  onChangeText={(t) => setPcts((x) => ({ ...x, [p.usuarioId]: limpiarPct(t) }))}
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
        </BloquePaso>
      )}

      {datosCambiados && (
        <Opcional titulo="¿Estaba mal registrado? Márcalo como corrección" abierto={corrigiendo}>
          <Field
            label="¿Qué estaba mal? (opcional)"
            value={motivoDato}
            onChangeText={setMotivoDato}
            autoCapitalize="sentences"
            placeholder="p. ej. estaba mal escrito el nombre del banco"
          />
        </Opcional>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  grupo: { gap: 8 },
  filaPct: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontSize: 14, color: c.text },
  pctInput: { width: 76 },
  pctSigno: { fontSize: 15, color: c.muted, fontWeight: '600' },
  total: { fontSize: 13, fontWeight: '700', color: c.muted, textAlign: 'right' },
  totalOk: { color: c.primary },
});
