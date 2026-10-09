import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError, type HogarDTO, type MiembroDTO, type ObjetivoFinancieroDTO } from '../api/client';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { emojiMeta } from '../emojis';
import { conEmoji, usePreferencias } from '../preferencias';
import {
  Button,
  ElegirEmoji,
  ElegirVarios,
  ErrorText,
  Field,
  MontoBanda,
  Nota,
  Screen,
  Segmented,
  Select,
  Skeleton,
  useC,
} from '../ui';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));
const ESTADOS = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;
const NOMBRE_ESTADO: Record<(typeof ESTADOS)[number], string> = {
  EN_PROGRESO: '⏳ En camino',
  COMPLETADO: '✅ Lograda',
  CANCELADO: '❌ Cancelada',
};
// G35: las monedas de siempre a un toque; "Otra" abre la lista completa.
const MONEDAS_RAPIDAS = ['CLP', 'USD', 'Otra'] as const;

/**
 * Formulario de una meta (plantillas de pantalla, R2 y R3). Sin `objetivoId`
 * crea; con él edita nombre, monto, estado y, si es tuya, con quién se
 * comparte y quiénes más pueden modificarla.
 */
export function MetaFormScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(), []);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { preferencias, guardarPreferencias } = usePreferencias();
  const objetivoId = nav.route.params?.objetivoId as string | undefined;

  const [obj, setObj] = useState<ObjetivoFinancieroDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [compartir, setCompartir] = useState<'No' | 'Sí'>('No');
  const [moneda, setMoneda] = useState('CLP');
  const [otraMoneda, setOtraMoneda] = useState(false);
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('EN_PROGRESO');
  const [designados, setDesignados] = useState<string[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [cargado, setCargado] = useState(!objetivoId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // G35: el emoji es una preferencia personal (no un dato de la meta).
  const [emoji, setEmoji] = useState(() => emojiMeta(objetivoId ?? '', preferencias.emojis.metas));

  useTitulo(objetivoId ? 'Editar meta' : undefined);

  const errNombre = nombre.trim() ? '' : 'Ponle un nombre a la meta.';
  const errMonto = Number(monto) > 0 ? '' : 'La meta debe ser mayor a 0.';

  useEffect(() => {
    (async () => {
      try {
        const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []);
        setHogarId(hs[0]?.id ?? null);
        if (!objetivoId) return;
        const o = await api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${objetivoId}`, token);
        setObj(o);
        setNombre(o.nombre);
        setMonto(String(o.montoObjetivo));
        setCompartir(o.hogarId ? 'Sí' : 'No');
        setEstado(o.estado as (typeof ESTADOS)[number]);
        setDesignados(o.designados);
        if (o.esMio && hs[0]) {
          const h = await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token).catch(() => null);
          setMiembros((h?.miembros ?? []).filter((m) => m.usuarioId !== usuario.id));
        }
        setCargado(true);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Error inesperado');
      }
    })();
  }, [token, objetivoId, usuario.id]);

  /** Guarda el emoji elegido si cambió; si falla, la meta igual quedó guardada. */
  const guardarEmoji = async (id: string) => {
    if (emoji === emojiMeta(id, preferencias.emojis.metas)) return;
    await guardarPreferencias(conEmoji(preferencias, 'metas', id, emoji)).catch(() =>
      toast.mostrar('No se pudo guardar el emoji', 'error'),
    );
  };

  const crear = async () => {
    const creada = await api.post<ObjetivoFinancieroDTO>(
      '/comandos/CrearObjetivoFinanciero',
      {
        nombre: nombre.trim(),
        montoObjetivo: Number(monto),
        ...(moneda !== 'CLP' ? { moneda: moneda.trim().toUpperCase() } : {}),
        ...(compartir === 'Sí' && hogarId ? { hogarId } : {}),
      },
      token,
    );
    await guardarEmoji(creada.id);
    toast.mostrar('Meta creada');
  };

  // Cada cambio va con su comando; solo se envía lo que cambió.
  const editar = async (o: ObjetivoFinancieroDTO) => {
    const datos: Record<string, unknown> = {};
    if (nombre.trim() !== o.nombre) datos.nombre = nombre.trim();
    if (Number(monto) !== o.montoObjetivo) datos.montoObjetivo = Number(monto);
    if (Object.keys(datos).length)
      await api.post('/comandos/ActualizarDatosObjetivoFinanciero', { objetivoId: o.id, ...datos }, token);
    if (estado !== o.estado)
      await api.post('/comandos/CambiarEstadoObjetivoFinanciero', { objetivoId: o.id, estado }, token);
    const compartida = compartir === 'Sí';
    if (o.esMio && hogarId && compartida !== !!o.hogarId)
      await api.post(
        '/comandos/CompartirObjetivoConHogar',
        { objetivoId: o.id, hogarId: compartida ? hogarId : null },
        token,
      );
    if (o.esMio && compartida && [...designados].sort().join() !== [...o.designados].sort().join())
      await api.post('/comandos/DefinirDesignadosObjetivo', { objetivoId: o.id, usuarioIds: designados }, token);
    await guardarEmoji(o.id);
    toast.mostrar('Meta guardada');
  };

  const guardar = async () => {
    if (errNombre || errMonto) return;
    setBusy(true);
    setError('');
    try {
      if (obj) await editar(obj);
      else await crear();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!cargado) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const puedeCompartir = !!hogarId && (!obj || obj.esMio);
  // G35: sin numerar; la moneda se elige antes del monto (al crear).
  return (
    <Screen
      pie={
        <Button
          title={obj ? '✏️ Guardar meta' : '🎯 Crear meta'}
          onPress={guardar}
          loading={busy}
          disabled={!!(errNombre || errMonto)}
        />
      }
    >
      {/* El emoji va pegado al nombre; se toca para cambiarlo. */}
      <View style={styles.nombreConEmoji}>
        <View style={{ flex: 1 }}>
          <Field
            label="¿Para qué juntas?"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="sentences"
            placeholder="p. ej. Pie vivienda"
          />
        </View>
        <ElegirEmoji compacto label="Emoji de la meta" value={emoji} onChange={setEmoji} />
      </View>
      {/* HZ-22: la decisión que cambia el significado del registro va segunda. */}
      {puedeCompartir && (
        <Segmented
          label="¿La comparten en el hogar?"
          options={['No', 'Sí'] as const}
          value={compartir}
          onChange={setCompartir}
          formatearOpcion={(v) => (v === 'Sí' ? '👥 Sí' : '🙋 No, es mía')}
        />
      )}
      {compartir === 'Sí' && !obj && (
        <Nota>Todos en el hogar la verán. Después puedes elegir quiénes más pueden cambiarla.</Nota>
      )}
      {compartir === 'Sí' && obj?.esMio && miembros.length > 0 && (
        <ElegirVarios
          label="¿Quién más puede cambiarla? (opcional)"
          values={designados}
          onChange={setDesignados}
          options={miembros.map((m) => ({ value: m.usuarioId, label: m.nombre }))}
        />
      )}
      {!obj && (
        <>
          <Segmented
            label="¿En qué moneda?"
            options={MONEDAS_RAPIDAS}
            value={otraMoneda ? 'Otra' : moneda === 'CLP' || moneda === 'USD' ? moneda : 'Otra'}
            onChange={(v) => {
              setOtraMoneda(v === 'Otra');
              if (v !== 'Otra') setMoneda(v);
            }}
            formatearOpcion={(v) => (v === 'Otra' ? '🌍 Otra' : v === 'USD' ? '💵 USD' : '🇨🇱 CLP')}
          />
          {otraMoneda && (
            <Select label="¿Cuál?" options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
          )}
        </>
      )}
      <MontoBanda
        label="¿Cuánto quieres juntar?"
        value={monto}
        onChange={setMonto}
        moneda={obj?.moneda ?? moneda}
        color={c.primary}
        emoji={emoji}
      />
      {obj && (
        <Segmented
          label="¿Cómo va?"
          options={ESTADOS}
          value={estado}
          onChange={setEstado}
          formatearOpcion={(v) => NOMBRE_ESTADO[v]}
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = () =>
  StyleSheet.create({
    nombreConEmoji: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  });
