import { useEffect, useState } from 'react';
import { api, ApiError, type EtiquetaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { EMOJI_ANOTAR } from '../emojis';
import {
  Button,
  colorAnotar,
  Cuando,
  ElegirVarios,
  ErrorText,
  Field,
  MontoBanda,
  Nota,
  Opcionales,
  Screen,
  useC,
} from '../ui';

/**
 * Editar un movimiento (plantillas de pantalla, R3). Monto, fecha y detalle se
 * corrigen con una corrección enlazada (pide motivo; el original queda
 * intacto); las etiquetas se cambian directo. Si el movimiento ya no se puede
 * corregir (es una corrección o ya fue corregido), solo se ven las etiquetas.
 */
export function CorregirMovimientoScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const p = nav.route.params as {
    eventoId: string;
    tipo: string;
    monto: number;
    fecha: string;
    glosa: string | null;
    moneda: string;
    corregible: boolean;
    etiquetaIds: string[];
  };

  const [monto, setMonto] = useState(String(p.monto));
  const [fecha, setFecha] = useState(p.fecha);
  const [glosa, setGlosa] = useState(p.glosa ?? '');
  const [motivo, setMotivo] = useState('');
  const [etiquetas, setEtiquetas] = useState<EtiquetaDTO[]>([]);
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>(p.etiquetaIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token).then(setEtiquetas).catch(() => setEtiquetas([]));
  }, [token]);

  const corrige =
    p.corregible && (Number(monto) !== p.monto || fecha !== p.fecha || glosa.trim() !== (p.glosa ?? ''));
  const cambianEtiquetas =
    etiquetaIds.length !== p.etiquetaIds.length || etiquetaIds.some((x) => !p.etiquetaIds.includes(x));
  const motivoOk = motivo.trim().length >= 3;
  const listo = (corrige || cambianEtiquetas) && Number(monto) > 0 && (!corrige || motivoOk);

  const guardar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      if (cambianEtiquetas) {
        await api.post('/comandos/EtiquetarEvento', { eventoId: p.eventoId, etiquetaIds }, token);
      }
      if (corrige) {
        const body: Record<string, unknown> = { eventoId: p.eventoId, motivo: motivo.trim() };
        if (Number(monto) !== p.monto) body.nuevoMonto = Number(monto);
        if (fecha !== p.fecha) body.nuevaFecha = fecha;
        if (glosa.trim() !== (p.glosa ?? '')) body.nuevaGlosa = glosa.trim();
        await api.post('/comandos/CorregirEventoFinanciero', body, token);
      }
      toast.mostrar(corrige ? 'Movimiento corregido' : 'Etiquetas actualizadas');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const elegirEtiquetas = (
    <ElegirVarios
      label="Etiquetas (opcional)"
      values={etiquetaIds}
      onChange={setEtiquetaIds}
      options={etiquetas.map((e) => ({ value: e.id, label: e.nombre, emoji: '🏷️' }))}
    />
  );
  return (
    <Screen pie={<Button title="Guardar cambios" onPress={guardar} loading={busy} disabled={!listo} />}>
      {p.corregible ? (
        <>
          <Nota>
            Puedes cambiar el monto, la fecha y el detalle. Para cambiar la cuenta o el tipo, elimínalo y
            anótalo de nuevo.
          </Nota>
          <MontoBanda
            label="¿Cuánto fue?"
            value={monto}
            onChange={setMonto}
            moneda={p.moneda}
            color={colorAnotar(c, p.tipo)}
            emoji={EMOJI_ANOTAR[p.tipo] ?? '🧾'}
          />
          <Cuando value={fecha} onChange={setFecha} />
          <Opcionales
            items={[
              {
                clave: 'detalle',
                emoji: '📝',
                titulo: 'Detalle',
                abierto: !!glosa,
                children: (
                  <Field label="Detalle (opcional)" value={glosa} onChangeText={setGlosa} autoCapitalize="sentences" />
                ),
              },
              ...(etiquetas.length > 0
                ? [{ clave: 'etiquetas', emoji: '🏷️', titulo: 'Etiquetas', abierto: etiquetaIds.length > 0, children: elegirEtiquetas }]
                : []),
            ]}
          />
        </>
      ) : (
        <>
          <Nota>Este movimiento ya se cambió una vez (o es un cambio): solo puedes cambiar sus etiquetas.</Nota>
          {etiquetas.length > 0 && elegirEtiquetas}
        </>
      )}
      {corrige && (
        <Field
          label="¿Por qué lo cambias?"
          value={motivo}
          onChangeText={setMotivo}
          placeholder="p. ej. me equivoqué en el monto"
          autoCapitalize="sentences"
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
