import { useEffect, useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos } from '../opciones';
import {
  Elegir,
  Button,
  contadorPasos,
  DateField,
  ErrorText,
  Field,
  MoneyField,
  Screen,
  Segmented,
} from '../ui';

const TIPOS = ['INGRESO', 'GASTO', 'TRANSFERENCIA'] as const;

/** Formulario de un movimiento programado nuevo (plantillas de pantalla, R2: ya no vive bajo la lista). */
export function NuevoProgramadoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('INGRESO');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [obs, setObs] = useState('');

  const usaOrigen = tipo === 'GASTO' || tipo === 'TRANSFERENCIA';
  const usaDestino = tipo === 'INGRESO' || tipo === 'TRANSFERENCIA';

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
      .then(setElementos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  const origen = elementos.find((e) => e.id === origenId);
  const destino = elementos.find((e) => e.id === destinoId);
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

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  return (
    <Screen
      pie={<Button title="Programar movimiento" onPress={crear} loading={busy} disabled={!puedeCrear || !monedaRef} />}
    >
      <Segmented label="Tipo" options={TIPOS} value={tipo} onChange={setTipo} paso={paso({ hecho: true })} />
      <MoneyField
        label="Monto planificado"
        paso={paso({ hecho: Number(monto) > 0 })}
        value={monto}
        onChange={setMonto}
        moneda={monedaRef}
      />
      <DateField label="Fecha" paso={paso({ hecho: fechaValida })} value={fecha} onChange={setFecha} />
      {usaOrigen && (
        <Elegir
          label="Desde qué cuenta"
          paso={paso({ hecho: !!origenId })}
          placeholder="Elegir cuenta"
          value={origenId}
          options={opcionesDeElementos(elementos, { saldo: false })}
          onChange={(v) => {
            setOrigenId(v);
            if (v === destinoId) setDestinoId(null);
          }}
        />
      )}
      {usaDestino && (
        <Elegir
          label="A qué cuenta"
          paso={paso({ hecho: !!destinoId })}
          placeholder="Elegir cuenta"
          value={destinoId}
          options={opcionesDeElementos(elementos, { saldo: false, excluir: usaOrigen ? origenId : null })}
          onChange={setDestinoId}
        />
      )}
      <Field label="Observaciones (opcional)" paso={paso()} value={obs} onChangeText={setObs} autoCapitalize="sentences" />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
