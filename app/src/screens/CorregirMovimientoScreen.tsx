import { useEffect, useState } from 'react';
import { api, ApiError, type EtiquetaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  AmountInput,
  Button,
  contadorPasos,
  Cuando,
  ElegirVarios,
  ErrorText,
  Field,
  Nota,
  Opcional,
  Screen,
} from '../ui';

/**
 * Editar un movimiento (plantillas de pantalla, R3). Monto, fecha y detalle se
 * corrigen con una corrección enlazada (pide motivo; el original queda
 * intacto); las etiquetas se cambian directo. Si el movimiento ya no se puede
 * corregir (es una corrección o ya fue corregido), solo se ven las etiquetas.
 */
export function CorregirMovimientoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const p = nav.route.params as {
    eventoId: string;
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

  const paso = contadorPasos();
  return (
    <Screen pie={<Button title={corrige ? 'Guardar corrección' : 'Guardar cambios'} onPress={guardar} loading={busy} disabled={!listo} />}>
      {p.corregible ? (
        <>
          <Nota>
            Para cambiar el tipo o las cuentas, elimínalo y regístralo de nuevo. Una corrección queda
            enlazada al original.
          </Nota>
          <AmountInput label="¿Cuánto fue?" paso={paso({ hecho: Number(monto) > 0 })} value={monto} onChange={setMonto} moneda={p.moneda} />
          <Cuando paso={paso({ hecho: true })} value={fecha} onChange={setFecha} />
          <Opcional titulo="Agregar detalle" abierto={!!glosa}>
            <Field label="Detalle (opcional)" value={glosa} onChangeText={setGlosa} autoCapitalize="sentences" />
          </Opcional>
        </>
      ) : (
        <Nota>Este movimiento ya no se puede corregir (es una corrección o ya fue corregido). Puedes cambiar sus etiquetas.</Nota>
      )}
      {etiquetas.length > 0 && (
        <ElegirVarios
          label="Etiquetas (opcional)"
          paso={paso()}
          values={etiquetaIds}
          onChange={setEtiquetaIds}
          options={etiquetas.map((e) => ({ value: e.id, label: e.nombre }))}
        />
      )}
      {corrige && (
        <Field
          label="¿Por qué lo corriges?"
          paso={paso({ hecho: motivoOk })}
          value={motivo}
          onChangeText={setMotivo}
          autoCapitalize="sentences"
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
