import { useEffect, useState } from 'react';
import { api, ApiError, type EtiquetaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { EMOJI_ANOTAR } from '../emojis';
import { money } from '../format';
import { diaCorto } from '../solicitudes';
import { ElegirMotivo } from './AccionFormScreen';
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

/** G39 (M12): lo que hace falta para anotarlo de nuevo con el formulario lleno. */
export interface Reanotar {
  origenId: string | null;
  destinoId: string | null;
  montoDestino: number | null;
  categoriaId: string | null;
  /** Lo que se elimina al anotar el nuevo, en orden (sus cambios y el original). */
  anular: string[];
}

/** G39 (F-7): el motivo de un cambio, a un toque. */
const MOTIVOS = [{ emoji: '✏️', texto: 'Me equivoqué al anotarlo' }];
const QUE: Record<string, string> = {
  GASTO: 'gasto',
  INGRESO: 'ingreso',
  TRANSFERENCIA: 'movimiento',
  CONVERSION: 'cambio de moneda',
};

/**
 * Editar un movimiento (plantillas de pantalla, R3). Monto, fecha y detalle se
 * corrigen con una corrección enlazada (el motivo viene elegido; el original
 * queda intacto); las etiquetas se cambian directo. Lo demás (cuenta, tipo,
 * categoría) se cambia con "Anotar de nuevo" (G39, M12): el formulario del "+"
 * lleno y, al anotar, se elimina este. Si ya no se puede corregir (es una
 * corrección, ya se corrigió o es un cambio de moneda), queda "Anotar de nuevo"
 * y las etiquetas.
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
    reanotar?: Reanotar | null;
  };

  const [monto, setMonto] = useState(String(p.monto));
  const [fecha, setFecha] = useState(p.fecha);
  const [glosa, setGlosa] = useState(p.glosa ?? '');
  const [motivo, setMotivo] = useState(MOTIVOS[0].texto);
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

  const reanotar = p.reanotar;
  const anotarDeNuevo = () => {
    if (!reanotar) return;
    nav.go('RegistrarMovimiento', {
      tipo: p.tipo === 'CONVERSION' ? 'TRANSFERENCIA' : p.tipo,
      monto: p.monto,
      fecha: p.fecha,
      glosa: p.glosa ?? '',
      origenId: reanotar.origenId ?? undefined,
      destinoId: reanotar.destinoId ?? undefined,
      categoriaId: reanotar.categoriaId ?? undefined,
      montoDestino: reanotar.montoDestino ?? undefined,
      reemplaza: {
        anular: reanotar.anular,
        texto: `el ${QUE[p.tipo] ?? 'movimiento'} de ${money(p.monto, p.moneda)} del ${diaCorto(p.fecha)}`,
      },
    });
  };
  const botonDeNuevo = reanotar ? (
    <Button title="🔁 Anotar de nuevo" variant="secondary" onPress={anotarDeNuevo} />
  ) : null;

  const elegirEtiquetas = (
    <ElegirVarios
      label="Etiquetas (opcional)"
      values={etiquetaIds}
      onChange={setEtiquetaIds}
      options={etiquetas.map((e) => ({ value: e.id, label: e.nombre, emoji: '🏷️' }))}
    />
  );
  return (
    <Screen
      pie={
        p.corregible || etiquetas.length > 0 ? (
          <Button title="Guardar cambios" onPress={guardar} loading={busy} disabled={!listo} />
        ) : undefined
      }
    >
      {p.corregible ? (
        <>
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
          {corrige && (
            <ElegirMotivo
              pregunta="¿Por qué lo cambias?"
              motivos={MOTIVOS}
              valor={motivo}
              onChange={setMotivo}
              placeholder="p. ej. me cobraron de más"
            />
          )}
          {botonDeNuevo && (
            <>
              <Nota>¿Era otra cuenta, otro tipo u otra categoría? Anótalo de nuevo: este se elimina.</Nota>
              {botonDeNuevo}
            </>
          )}
        </>
      ) : (
        <>
          <Nota>
            {botonDeNuevo
              ? p.tipo === 'CONVERSION'
                ? 'Un cambio de moneda no se edita: anótalo de nuevo con lo correcto y este se elimina.'
                : 'Ya lo cambiaste una vez: para cambiarlo otra vez, anótalo de nuevo y este se elimina.'
              : 'Es el cambio de otro movimiento: solo puedes cambiar sus etiquetas.'}
          </Nota>
          {botonDeNuevo}
          {etiquetas.length > 0 && elegirEtiquetas}
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
