import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, ApiError, type CategoriaMovimientoDTO, type ElementoPatrimonialDTO, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos, opcionesDeMiembros } from '../opciones';
import { money } from '../format';
import { EMOJI_ANOTAR, emojiCategoria } from '../emojis';
import { usePreferencias } from '../preferencias';
import { cadaCuando, OPCIONES_REPITE, type Periodicidad } from '../recurrencia';
import {
  colorAnotar,
  Elegir,
  Button,
  DateField,
  ErrorText,
  fechaLegible,
  Field,
  MontoBanda,
  Nota,
  Opcionales,
  Pastilla,
  Question,
  Screen,
  Segmented,
  useC,
} from '../ui';

// G35: el gasto primero (es lo que más se programa), con las palabras y emojis del "+".
const TIPOS = ['GASTO', 'INGRESO', 'TRANSFERENCIA'] as const;
const NOMBRE_TIPO = { GASTO: 'Gasto', INGRESO: 'Ingreso', TRANSFERENCIA: 'Moví plata' } as const;
const EMOJI_REPITE: Record<string, string> = { NO: '', MENSUAL: '🔁 ', ANUAL: '📆 ' };

/** Formulario de un movimiento programado nuevo (plantillas de pantalla, R2: ya no vive bajo la lista). */
export function NuevoProgramadoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const c = useC();
  const { preferencias } = usePreferencias();
  const emojis = preferencias.emojis;
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [elementosHogar, setElementosHogar] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('GASTO');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  // D-6: se repite cada mes o cada año, con categoría (solo ingreso y gasto).
  const [repite, setRepite] = useState<'NO' | Periodicidad>('NO');
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

  const usaOrigen = tipo === 'GASTO' || tipo === 'TRANSFERENCIA';
  const usaDestino = tipo === 'INGRESO' || tipo === 'TRANSFERENCIA';

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
      .then(setElementos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error'));
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token)
      .then(setElementosHogar)
      .catch(() => setElementosHogar([]));
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) =>
        hs[0] ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hs[0].id}/categorias-movimiento`, token) : [],
      )
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [token]);

  // D-5: una transferencia puede ir a la cuenta de otro miembro del hogar (las
  // que comparte desde "Que puedan transferirte"); el origen sigue siendo propio.
  const propios = new Set(elementos.map((e) => e.id));
  const deMiembros = elementosHogar.filter((e) => !propios.has(e.id));
  const cambiarTipo = (t: (typeof TIPOS)[number]) => {
    setTipo(t);
    setCategoriaId(null);
    if (t !== 'TRANSFERENCIA' && destinoId && !propios.has(destinoId)) setDestinoId(null);
  };

  const catAplicables = categorias.filter(
    (c) => c.estado === 'ACTIVA' && (c.tipoAplicable === 'AMBOS' || c.tipoAplicable === tipo),
  );
  const origen = elementos.find((e) => e.id === origenId);
  const destino = [...elementos, ...deMiembros].find((e) => e.id === destinoId);
  const monedaRef = (usaOrigen ? origen : destino)?.moneda;

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim());
  const puedeCrear =
    Number(monto) > 0 &&
    fechaValida &&
    (!usaOrigen || !!origenId) &&
    (!usaDestino || !!destinoId) &&
    (tipo !== 'TRANSFERENCIA' || origenId !== destinoId);

  const crear = async () => {
    if (!puedeCrear || !monedaRef) return;
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearMovimientoProgramado',
        {
          tipo,
          montoPlanificado: Number(monto),
          moneda: monedaRef,
          fechaProgramada: fecha.trim(),
          ...(usaOrigen && origen ? { elementoOrigenId: origen.id } : {}),
          ...(usaDestino && destino ? { elementoDestinoId: destino.id } : {}),
          ...(obs.trim() ? { observaciones: obs.trim() } : {}),
          ...(repite !== 'NO' ? { periodicidad: repite } : {}),
          ...(tipo !== 'TRANSFERENCIA' && categoriaId ? { categoriaId } : {}),
        },
        token,
      );
      toast.mostrar('Movimiento programado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const nombreDe = (id: string | null) => [...elementos, ...deMiembros].find((e) => e.id === id)?.nombre ?? '';
  const m = monedaRef ? `${Number(monto) ? money(Number(monto), monedaRef) : ''}` : '';
  const cuando = !fechaValida ? '' : repite !== 'NO' ? ` ${cadaCuando(repite, fecha)}` : ` el ${fechaLegible(fecha)}`;
  const aviso = repite !== 'NO' ? 'Te avisamos' : 'Te recordamos';
  const resumen = !puedeCrear
    ? 'Completa monto, cuenta y fecha.'
    : tipo === 'INGRESO'
      ? `${EMOJI_ANOTAR[tipo]} ${aviso}${cuando} para confirmar que entraron ${m} a ${nombreDe(destinoId)}.`
      : tipo === 'GASTO'
        ? `${EMOJI_ANOTAR[tipo]} ${aviso}${cuando} para confirmar que salieron ${m} de ${nombreDe(origenId)}.`
        : `${EMOJI_ANOTAR[tipo]} ${aviso}${cuando} para confirmar el paso de ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)}.`;

  return (
    <Screen
      pie={
        <>
          <Nota>{resumen}</Nota>
          <Button
            title={`🗓️ Programar ${tipo === 'TRANSFERENCIA' ? 'movimiento' : NOMBRE_TIPO[tipo].toLowerCase()}`}
            onPress={crear}
            loading={busy}
            disabled={!puedeCrear || !monedaRef}
          />
        </>
      }
    >
      <Segmented
        options={TIPOS}
        value={tipo}
        onChange={cambiarTipo}
        formatearOpcion={(t) => `${EMOJI_ANOTAR[t]} ${NOMBRE_TIPO[t]}`}
      />
      <MontoBanda
        value={monto}
        onChange={setMonto}
        moneda={monedaRef}
        color={colorAnotar(c, tipo)}
        emoji={EMOJI_ANOTAR[tipo]}
      />
      {usaOrigen && (
        <Elegir
          label={tipo === 'GASTO' ? '¿Desde qué cuenta sale?' : '¿Desde qué cuenta?'}
          placeholder="Elegir cuenta"
          value={origenId}
          options={opcionesDeElementos(elementos, { saldo: false, emojis: emojis.elementos })}
          onChange={(v) => {
            setOrigenId(v);
            if (v === destinoId) setDestinoId(null);
          }}
        />
      )}
      {usaDestino && (
        <Elegir
          label={tipo === 'INGRESO' ? '¿A qué cuenta llega?' : '¿A qué cuenta?'}
          placeholder="Elegir cuenta"
          value={destinoId}
          options={[
            ...opcionesDeElementos(elementos, {
              saldo: false,
              excluir: usaOrigen ? origenId : null,
              emojis: emojis.elementos,
            }),
            ...(tipo === 'TRANSFERENCIA' ? opcionesDeMiembros(deMiembros, { emojis: emojis.elementos }) : []),
          ]}
          onChange={setDestinoId}
        />
      )}
      {tipo !== 'TRANSFERENCIA' && catAplicables.length > 0 && (
        <Elegir
          label="¿De qué categoría? (opcional)"
          opcionNula="Sin categoría"
          value={categoriaId}
          options={catAplicables.map((x) => ({
            value: x.id,
            label: x.nombre,
            emoji: emojiCategoria(x) ?? '🏷️',
            sub: x.categoriaPadreId
              ? `Dentro de ${categorias.find((p) => p.id === x.categoriaPadreId)?.nombre ?? 'otra'}`
              : undefined,
          }))}
          onChange={setCategoriaId}
        />
      )}
      <View style={{ gap: 8 }}>
        <Question>¿Se repite?</Question>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {OPCIONES_REPITE.map((o) => (
            <Pastilla
              key={o.value}
              label={`${EMOJI_REPITE[o.value]}${o.label}`}
              activo={repite === o.value}
              onPress={() => setRepite(o.value as 'NO' | Periodicidad)}
            />
          ))}
        </View>
      </View>
      <DateField
        label={repite !== 'NO' ? '¿Cuándo es la primera vez?' : '¿Para cuándo?'}
        value={fecha}
        onChange={setFecha}
      />
      <Opcionales
        items={[
          {
            clave: 'detalle',
            emoji: '📝',
            titulo: 'Detalle',
            abierto: !!obs,
            children: (
              <Field
                label="Detalle (opcional)"
                value={obs}
                onChangeText={setObs}
                autoCapitalize="sentences"
                placeholder="p. ej. sueldo de octubre"
              />
            ),
          },
        ]}
      />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
