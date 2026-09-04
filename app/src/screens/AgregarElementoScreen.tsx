import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  colors,
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
} from '../ui';
import {
  etiqueta,
  MONEDAS_FRECUENTES,
  NOMBRE_MONEDA,
  TIPOS_ELEMENTO_SUGERIDOS,
} from '../labels';

const CATEGORIAS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const;
const OPC_CATEGORIA = CATEGORIAS.map((c) => ({ value: c, label: etiqueta(c) }));
const OPC_TIPO = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({ value: t, label: etiqueta(t) }));
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
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('cuenta_corriente');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('LIQUIDEZ');
  const [valorInicial, setValorInicial] = useState('0');
  const [valorPendiente, setValorPendiente] = useState('');
  const [moneda, setMoneda] = useState('CLP');
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
      .then((hs) => (hs[0] ? api.get<HogarDTO>(`/hogares/${hs[0].id}`, token) : null))
      .then((h) => setMiembros(h?.miembros ?? []))
      .catch(() => setMiembros([]));
  }, [token]);

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
    tipo !== 'cuenta_corriente' ||
    categoria !== 'LIQUIDEZ' ||
    valorInicial !== '0' ||
    valorPendiente !== '' ||
    moneda !== 'CLP' ||
    propiedad !== 'Solo mía';
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  // ── Validación por paso ───────────────────────────────────────────────────
  const errNombre = nombre.trim() ? '' : 'Escribe un nombre para identificarlo.';
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
    p === 1 ? errNombre : p === 2 ? errMoneda || errPendiente : errReparto;
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
    if (errNombre || errMoneda || errPendiente || errReparto) return;
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
          ...(compartida && propietarios.length > 1 ? { propietarios } : {}),
          ...(esDeudaOCredito
            ? { valorPendiente: Number(valorPendiente) || 0 }
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
          <Select label="Tipo" value={tipo} options={OPC_TIPO} onChange={setTipo} permiteOtro />
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

const styles = StyleSheet.create({
  reparto: { gap: 10 },
  filaPct: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontSize: 14, color: colors.text },
  pctInput: { width: 76 },
  pctSigno: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  total: { fontSize: 13, fontWeight: '700', color: colors.muted, textAlign: 'right' },
  totalOk: { color: colors.primary },
  pie: { gap: 10 },
  atras: { alignItems: 'center' },
});
