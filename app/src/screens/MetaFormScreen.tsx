import { useEffect, useState } from 'react';
import { api, ApiError, type HogarDTO, type MiembroDTO, type ObjetivoFinancieroDTO } from '../api/client';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { emojiMeta } from '../emojis';
import { conEmoji, usePreferencias } from '../preferencias';
import {
  AmountInput,
  Button,
  contadorPasos,
  ElegirEmoji,
  ElegirVarios,
  ErrorText,
  Field,
  Nota,
  Screen,
  Segmented,
  Select,
  Skeleton,
} from '../ui';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));
const ESTADOS = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;

/**
 * Formulario de una meta (plantillas de pantalla, R2 y R3). Sin `objetivoId`
 * crea; con él edita nombre, monto, estado y, si es tuya, con quién se
 * comparte y quiénes más pueden modificarla.
 */
export function MetaFormScreen() {
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
  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <Button
          title={obj ? 'Guardar meta' : 'Crear meta'}
          onPress={guardar}
          loading={busy}
          disabled={!!(errNombre || errMonto)}
        />
      }
    >
      <Field
        label="¿Cómo se llama la meta?"
        paso={paso({ hecho: !errNombre })}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="sentences"
        placeholder="Pie vivienda"
      />
      <ElegirEmoji value={emoji} onChange={setEmoji} />
      {/* HZ-22: la decisión que cambia el significado del registro va en el paso 2. */}
      {puedeCompartir && (
        <Segmented
          label="¿Compartir con el hogar?"
          paso={paso({ hecho: true })}
          options={['No', 'Sí'] as const}
          value={compartir}
          onChange={setCompartir}
          formatearOpcion={(v) => v}
        />
      )}
      {compartir === 'Sí' && !obj && (
        <Nota>Todos los miembros la verán. Podrás designar quiénes pueden modificarla.</Nota>
      )}
      {compartir === 'Sí' && obj?.esMio && miembros.length > 0 && (
        <ElegirVarios
          label="¿Quién más puede modificarla? (opcional)"
          paso={paso()}
          values={designados}
          onChange={setDesignados}
          options={miembros.map((m) => ({ value: m.usuarioId, label: m.nombre }))}
        />
      )}
      <AmountInput
        label="¿Cuánto quieres juntar?"
        paso={paso({ hecho: !errMonto })}
        value={monto}
        onChange={setMonto}
        moneda={obj?.moneda ?? moneda}
      />
      {obj ? (
        <Segmented
          label="¿En qué estado está?"
          paso={paso({ hecho: true })}
          options={ESTADOS}
          value={estado}
          onChange={setEstado}
        />
      ) : (
        <Select
          label="¿En qué moneda?"
          paso={paso({ hecho: !!moneda })}
          options={OPC_MONEDA}
          value={moneda}
          onChange={setMoneda}
          permiteOtro
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
