import { useMemo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
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
import { usePreferencias } from '../preferencias';
import { EMOJI_CATEGORIA_FUNCIONAL, emojiElemento, emojiMoneda, emojiTipoElemento } from '../emojis';
import { radio } from '../ui/tema';
import {
  altaPorDefecto,
  aplicarNivel,
  NIVEL_POR_DEFECTO,
  opcionesNivel,
  type NivelHogar,
} from '../compartirHogar';
import {
  Ayuda,
  Button,
  DateField,
  Elegir,
  ErrorText,
  Field,
  MoneyField,
  MontoBanda,
  Nota,
  Opcionales,
  Panel,
  Pastilla,
  Question,
  Screen,
  Segmented,
  Select,
  tinte,
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
/** G35: "¿Qué es?" va primero, como tarjetas; define el resto del formulario. */
const QUE_ES: Record<Categoria, { titulo: string; sub: string; agregar: string; ejemplo: string }> = {
  LIQUIDEZ: {
    titulo: 'Cuenta',
    sub: 'Corriente, vista, RUT, efectivo',
    agregar: 'Agregar cuenta',
    ejemplo: 'Ej: Cuenta RUT',
  },
  RESERVA: {
    titulo: 'Ahorro',
    sub: 'Cuenta de ahorro, fondo de emergencia',
    agregar: 'Agregar ahorro',
    ejemplo: 'Ej: Fondo de emergencia',
  },
  INVERSION: {
    titulo: 'Inversión',
    sub: 'Fondos, acciones, APV, depósitos',
    agregar: 'Agregar inversión',
    ejemplo: 'Ej: Fondo Fintual',
  },
  ACTIVO: {
    titulo: 'Bien',
    sub: 'Casa, departamento, auto',
    agregar: 'Agregar bien',
    ejemplo: 'Ej: Departamento',
  },
  DEUDA: {
    titulo: 'Deuda',
    sub: 'Tarjeta, crédito, préstamo',
    agregar: 'Agregar deuda',
    ejemplo: 'Ej: Tarjeta Falabella',
  },
  CREDITO: {
    titulo: 'Te deben',
    sub: 'Plata que le prestaste a alguien',
    agregar: 'Agregar lo que te deben',
    ejemplo: 'Ej: Préstamo a Nico',
  },
};
const NUEVO_TIPO = '__nuevo__';
const OPC_TIPO_FALLBACK = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({ value: etiqueta(t), label: etiqueta(t) }));
const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
  emoji: emojiMoneda(m),
}));
/** G39 (F-6): cuántos tipos van como botones y en qué categorías viene uno elegido. */
const TIPOS_A_LA_VISTA = 5;
const TIPO_POR_DEFECTO: Categoria[] = ['LIQUIDEZ', 'RESERVA', 'INVERSION'];
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
 * G33 bloque 6 — C1 (HZ-9): una sola pantalla con pocos datos (qué es, tipo,
 * nombre y saldo de hoy, obligatorio y sin 0 por defecto); lo demás tiene
 * valores por defecto y queda en los opcionales. G35: "¿Qué es?" va primero,
 * como tarjetas, y el resto aparece al elegir. D-2: la pregunta del hogar
 * aparece después de crear; si se omite, queda en "Que puedan transferirte".
 */
export function AgregarElementoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const { preferencias } = usePreferencias();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const catInicial = CATEGORIAS.includes(nav.route.params?.categoria as Categoria)
    ? (nav.route.params?.categoria as Categoria)
    : null;

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [catElegida, setCatElegida] = useState<Categoria | null>(catInicial);
  const categoria: Categoria = catElegida ?? 'LIQUIDEZ';
  const mensaje = nav.route.params?.mensaje as string | undefined;
  const [tiposCat, setTiposCat] = useState<TipoElementoDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [crearTipo, setCrearTipo] = useState(false);
  const [verQueEs, setVerQueEs] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState('');
  const [tipoBusy, setTipoBusy] = useState(false);
  const [monto, setMonto] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [cuota, setCuota] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [fechaAlta, setFechaAlta] = useState('');
  const [valorizable, setValorizable] = useState<'No' | 'Sí'>(valorizaPorDefecto(catInicial ?? 'LIQUIDEZ'));
  const [naturaleza, setNaturaleza] = useState<'Financiera' | 'Encargo o custodia'>('Financiera');
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

  // Los tipos de lo que se eligió en "¿Qué es?" (y los sin categoría), en el
  // orden del catálogo; "➕ Nuevo tipo" al final.
  const delaCat = tiposCat.filter((t) => !t.categoriaSugerida || t.categoriaSugerida === categoria);
  const opcTipo = [
    ...(tiposCat.length > 0
      ? delaCat.map((t) => ({
          value: t.nombre,
          label: t.nombre,
          emoji: emojiTipoElemento(t.nombre, t.categoriaSugerida),
        }))
      : OPC_TIPO_FALLBACK),
    ...(hogarId ? [{ value: NUEVO_TIPO, label: 'Nuevo tipo', emoji: '➕' }] : []),
  ];
  // G39 (F-6): los tipos como botones; con muchos, el resto en "Ver todos".
  const tiposBotones: { value: string; label: string; emoji?: string }[] = opcTipo.filter((o) => o.value !== NUEVO_TIPO);
  const tiposALaVista = tiposBotones.slice(0, TIPOS_A_LA_VISTA);

  // G39 (F-6): en Cuenta, Ahorro e Inversión el tipo no cambia nada para el
  // usuario: viene el primero de lo elegido (se cambia con un toque). En Bien,
  // Deuda y Te deben se elige, porque cambia lo que se pregunta y cómo se paga.
  useEffect(() => {
    if (!catElegida || tipo || !TIPO_POR_DEFECTO.includes(catElegida)) return;
    const primero = delaCat.find((t) => t.categoriaSugerida === catElegida) ?? delaCat[0];
    if (primero) setTipo(primero.nombre);
    else if (tiposCat.length === 0 && OPC_TIPO_FALLBACK[0]) setTipo(OPC_TIPO_FALLBACK[0].value);
  }, [catElegida, tipo, delaCat, tiposCat.length]);

  const elegirCategoria = (cat: Categoria) => {
    if (cat === catElegida) return;
    setCatElegida(cat);
    setValorizable(valorizaPorDefecto(cat));
    // El tipo elegido puede no ser de lo nuevo.
    const t = tiposCat.find((x) => x.nombre === tipo);
    if (t?.categoriaSugerida && t.categoriaSugerida !== cat) setTipo('');
  };

  const elegirTipo = (v: string) => {
    if (v === NUEVO_TIPO) {
      setCrearTipo(true);
      return;
    }
    setTipo(v);
    setCrearTipo(false);
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
    // Los errores de los opcionales se muestran ahí (se abren solos).
    if (!catElegida || errNombre || errTipo || errMonto || errMoneda || errReparto) return;
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
          <Text style={styles.listo}>
            🎉 {creado.nombre} quedó agregada
          </Text>
          <Text style={styles.muted}>
            {emojiElemento(creado, preferencias.emojis.elementos)}{' '}
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

  const monedaVista = moneda.trim().toUpperCase() || undefined;
  const que = catElegida ? QUE_ES[catElegida] : null;
  const colorBanda = categoria === 'DEUDA' ? c.danger : categoria === 'CREDITO' ? c.ok : c.primary;

  return (
    <Screen
      pie={
        <Button
          title={que ? `${EMOJI_CATEGORIA_FUNCIONAL[categoria]} ${que.agregar}` : 'Agregar'}
          onPress={onSubmit}
          loading={loading}
          disabled={!catElegida || !!(errNombre || errTipo || errMonto)}
        />
      }
    >
      {mensaje ? <Ayuda>{mensaje}</Ayuda> : null}

      <Question>¿Qué es?</Question>
      {que && !verQueEs ? (
        // Ya elegido: una fila con "Cambiar", para que el resto del formulario quede a la vista.
        <Pressable
          onPress={() => setVerQueEs(true)}
          accessibilityRole="button"
          accessibilityLabel={`${que.titulo}. Cambiar qué es`}
          style={({ pressed }) => [styles.queEsElegida, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.queEsEmoji}>{EMOJI_CATEGORIA_FUNCIONAL[categoria]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.queEsTitulo}>{que.titulo}</Text>
            <Text style={styles.queEsSub} numberOfLines={1}>
              {que.sub}
            </Text>
          </View>
          <Text style={styles.cambiar}>Cambiar</Text>
        </Pressable>
      ) : (
        <View style={styles.queEs}>
          {CATEGORIAS.map((cat) => {
            const elegida = cat === catElegida;
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  elegirCategoria(cat);
                  setVerQueEs(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: elegida }}
                accessibilityLabel={`${QUE_ES[cat].titulo}: ${QUE_ES[cat].sub}`}
                style={({ pressed }) => [
                  styles.queEsCard,
                  elegida && {
                    borderColor: c.primary,
                    backgroundColor: tinte(c.primary, 0.12),
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.queEsEmoji}>{EMOJI_CATEGORIA_FUNCIONAL[cat]}</Text>
                <Text style={styles.queEsTitulo}>{QUE_ES[cat].titulo}</Text>
                <Text style={styles.queEsSub} numberOfLines={2}>
                  {QUE_ES[cat].sub}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {que && (
        <>
          <View style={{ gap: 8 }}>
            <Question>¿De qué tipo?</Question>
            <View style={styles.botones}>
              {tiposALaVista.map((o) => (
                <Pastilla
                  key={o.value}
                  label={`${o.emoji ? `${o.emoji} ` : ''}${o.label}`}
                  activo={tipo === o.value}
                  onPress={() => elegirTipo(o.value)}
                />
              ))}
              {tipo && !tiposALaVista.some((o) => o.value === tipo) ? (
                <Pastilla label={tipo} activo onPress={() => undefined} />
              ) : null}
              {tiposBotones.length > TIPOS_A_LA_VISTA && (
                <Select
                  label="¿De qué tipo?"
                  value={tipo}
                  options={tiposBotones}
                  onChange={elegirTipo}
                  boton={(abrir) => <Pastilla label={`🔍 Ver todos (${tiposBotones.length})`} enlace onPress={abrir} />}
                />
              )}
              {hogarId ? <Pastilla label="➕ Otro" enlace onPress={() => elegirTipo(NUEVO_TIPO)} /> : null}
            </View>
          </View>
          {mostrar(errTipo) ? <ErrorText>{errTipo}</ErrorText> : null}
          {crearTipo ? (
            <View style={{ gap: 8 }}>
              <Field
                label=""
                value={tipoNuevo}
                onChangeText={setTipoNuevo}
                autoCapitalize="sentences"
                placeholder={`Nuevo tipo de ${que.titulo.toLowerCase()}`}
                autoFocus
              />
              <View style={styles.fila}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Crear"
                    variant="secondary"
                    onPress={crearTipoInline}
                    loading={tipoBusy}
                    disabled={!tipoNuevo.trim()}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Cancelar" variant="secondary" onPress={() => setCrearTipo(false)} />
                </View>
              </View>
            </View>
          ) : null}

          <Field
            label="¿Cómo se llama?"
            value={nombre}
            onChangeText={setNombre}
            placeholder={que.ejemplo}
            autoCapitalize="sentences"
            error={mostrar(errNombre)}
          />

          <MontoBanda
            label={
              categoria === 'DEUDA'
                ? '¿Cuánto debes hoy?'
                : categoria === 'CREDITO'
                  ? '¿Cuánto te deben hoy?'
                  : categoria === 'ACTIVO'
                    ? '¿Cuánto vale hoy?'
                    : '¿Cuánto tiene hoy?'
            }
            value={monto}
            onChange={setMonto}
            moneda={monedaVista}
            color={colorBanda}
            emoji={tipo ? emojiTipoElemento(tipo, categoria) : EMOJI_CATEGORIA_FUNCIONAL[categoria]}
          >
            <Text style={styles.bandaNota}>
              {categoria === 'DEUDA'
                ? 'Lo que debes a la fecha, según tu estado de cuenta o la app del banco.'
                : categoria === 'CREDITO'
                  ? 'Lo que te deben a la fecha. Baja cuando te pagan.'
                  : categoria === 'ACTIVO'
                    ? 'Lo que vale hoy, aproximado.'
                    : 'El saldo que ves hoy en la app de tu banco.'}
            </Text>
          </MontoBanda>
          {mostrar(errMonto) ? <ErrorText>{errMonto}</ErrorText> : null}

          {esDeudaOCredito && !esTarjeta && (
            <Segmented
              label={categoria === 'DEUDA' ? '¿Es una deuda de verdad?' : '¿Es un préstamo de verdad?'}
              options={['Financiera', 'Encargo o custodia'] as const}
              value={naturaleza}
              onChange={setNaturaleza}
              formatearOpcion={(v) =>
                v === 'Financiera'
                  ? categoria === 'DEUDA'
                    ? '💳 Sí, la debo'
                    : '🤝 Sí, me deben'
                  : '📦 Es un encargo'
              }
            />
          )}
          {esDeudaOCredito && !esTarjeta && naturaleza === 'Encargo o custodia' && (
            <Nota>
              Plata de otra persona que pasa por tus cuentas (p. ej. para comprarle algo). Se muestra aparte.
            </Nota>
          )}

          <Opcionales
            items={[
              {
                clave: 'moneda',
                emoji: '💱',
                titulo: 'Otra moneda',
                abierto: moneda !== 'CLP' || !!mostrar(errMoneda),
                children: (
                  <>
                    <Select
                      label="¿En qué moneda está?"
                      value={moneda}
                      options={OPC_MONEDA}
                      onChange={setMoneda}
                      permiteOtro
                    />
                    {mostrar(errMoneda) ? <ErrorText>{errMoneda}</ErrorText> : null}
                  </>
                ),
              },
              {
                clave: 'desde',
                emoji: '📅',
                titulo: 'Desde cuándo',
                abierto: fechaAlta !== '',
                children: (
                  <DateField
                    label="¿Desde cuándo la tienes?"
                    value={fechaAlta}
                    onChange={setFechaAlta}
                    optional
                  />
                ),
              },
              ...(esDeudaOCredito
                ? [
                    {
                      clave: 'contraparte',
                      emoji: categoria === 'DEUDA' ? '🏛️' : '👤',
                      titulo: categoria === 'DEUDA' ? 'A quién le debes' : 'Quién te debe',
                      abierto: contraparte !== '',
                      children: (
                        <Field
                          label={categoria === 'DEUDA' ? '¿A quién le debes?' : '¿Quién te debe?'}
                          value={contraparte}
                          onChangeText={setContraparte}
                          autoCapitalize="sentences"
                          placeholder={categoria === 'DEUDA' ? 'Banco, persona…' : 'A quién le prestaste'}
                        />
                      ),
                    },
                    {
                      clave: 'cuota',
                      emoji: '💵',
                      titulo: 'Cuota',
                      abierto: cuota !== '',
                      children: (
                        <MoneyField label="¿De cuánto es la cuota?" value={cuota} onChange={setCuota} />
                      ),
                    },
                    {
                      clave: 'hasta',
                      emoji: '🏁',
                      titulo: 'Hasta cuándo',
                      abierto: fechaTermino !== '',
                      children: (
                        <DateField
                          label="¿Hasta cuándo?"
                          value={fechaTermino}
                          onChange={setFechaTermino}
                          optional
                        />
                      ),
                    },
                  ]
                : [
                    {
                      clave: 'valoriza',
                      emoji: '📈',
                      titulo: 'Cambia de valor',
                      abierto: valorizable !== valorizaPorDefecto(categoria),
                      children: (
                        <Segmented
                          label="¿Su valor cambia con el tiempo? (casas, inversiones)"
                          options={['No', 'Sí'] as const}
                          value={valorizable}
                          onChange={setValorizable}
                        />
                      ),
                    },
                  ]),
              ...(hayComiembros
                ? [
                    {
                      clave: 'propiedad',
                      emoji: '👥',
                      titulo: 'Es de varios',
                      abierto: propiedad !== 'Solo mía',
                      children: (
                        <>
                          <Segmented
                            label="¿De quién es?"
                            options={['Solo mía', 'Compartida'] as const}
                            value={propiedad}
                            onChange={onPropiedad}
                            formatearOpcion={(v) => (v === 'Solo mía' ? '🙋 Solo mía' : '👥 Compartida')}
                          />
                          {compartida ? (
                            <View style={styles.reparto}>
                              <Nota>Reparte el 100%. Cada uno ve su parte; el hogar la ve completa.</Nota>
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
                                        setPcts((p) => ({
                                          ...p,
                                          [m.usuarioId]: limpiarPct(t),
                                        }))
                                      }
                                      keyboardType="numeric"
                                      placeholder="0"
                                    />
                                  </View>
                                  <Text style={styles.pctSigno}>%</Text>
                                </View>
                              ))}
                              <Text
                                style={[styles.total, Math.abs(totalPct - 100) < 0.001 && styles.totalOk]}
                              >
                                Total: {Math.round(totalPct * 100) / 100}%
                              </Text>
                              {mostrar(errReparto) ? <ErrorText>{errReparto}</ErrorText> : null}
                            </View>
                          ) : null}
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  listo: { fontSize: 18, fontWeight: '700', color: c.text },
  queEs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  queEsCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 96,
    padding: 12,
    gap: 2,
    borderRadius: radio.tarjeta,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.bg,
  },
  queEsElegida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radio.tarjeta,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: tinte(c.primary, 0.12),
  },
  queEsEmoji: { fontSize: 26 },
  queEsTitulo: { fontSize: 16, fontWeight: '700', color: c.text },
  queEsSub: { fontSize: 12, color: c.muted },
  cambiar: { fontSize: 15, fontWeight: '700', color: c.primary },
  bandaNota: { fontSize: 13, color: c.muted },
  fila: { flexDirection: 'row', gap: 12 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: tipoDe(c).nota,
  reparto: { gap: 10 },
  filaPct: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontSize: 14, color: c.text },
  pctInput: { width: 76 },
  pctSigno: { fontSize: 15, color: c.muted, fontWeight: '600' },
  total: { fontSize: 13, fontWeight: '700', color: c.muted, textAlign: 'right' },
  totalOk: { color: c.primary },
});
