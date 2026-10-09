import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { EMOJI_ANOTAR } from '../emojis';
import { aISO, Button, colorAnotar, Cuando, DateField, ErrorText, MontoBanda, Nota, Screen, useC } from '../ui';

/**
 * Editar un movimiento programado o confirmar su pago (plantillas de pantalla,
 * R3): las dos preguntan monto y fecha. Al confirmar, se registra el movimiento
 * real con lo que efectivamente pasó.
 */
export function ProgramadoFormScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const modo = nav.route.params?.modo as 'editar' | 'confirmar';
  const movimientoId = nav.route.params?.movimientoId as string;
  const planificado = nav.route.params?.monto as number;
  const moneda = nav.route.params?.moneda as string;
  const tipo = (nav.route.params?.tipo as 'GASTO' | 'INGRESO' | 'TRANSFERENCIA' | undefined) ?? 'GASTO';
  const cuenta = nav.route.params?.cuenta as string | undefined;
  const confirmar = modo === 'confirmar';
  const ingreso = tipo === 'INGRESO';

  const [monto, setMonto] = useState(String(planificado));
  // Al confirmar, lo normal es que se pagó el día que tocaba (D-6: el aviso puede
  // llegar tarde), o hoy si se adelanta; al editar, se parte de la fecha programada.
  const programada = (nav.route.params?.fecha as string).slice(0, 10);
  const hoy = aISO(new Date());
  const [fecha, setFecha] = useState(confirmar && programada > hoy ? hoy : programada);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useTitulo(confirmar ? (ingreso ? 'Confirmar lo que llegó' : 'Confirmar pago') : 'Cambiar monto o fecha');

  const montoOk = Number(monto) > 0;
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(fecha);

  const guardar = async () => {
    if (!montoOk || !fechaOk) return;
    setBusy(true);
    setError('');
    try {
      if (confirmar) {
        await api.post(
          '/comandos/MaterializarMovimientoProgramado',
          { movimientoId, montoEfectivo: Number(monto), fechaEfectiva: fecha },
          token,
        );
        toast.mostrar('Listo, quedó anotado');
      } else {
        await api.post(
          '/comandos/ActualizarMovimientoProgramado',
          { movimientoId, montoPlanificado: Number(monto), fechaProgramada: fecha },
          token,
        );
        toast.mostrar('Guardado');
      }
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  // G35: el pie dice qué se anota y dónde.
  const queSeAnota = `${EMOJI_ANOTAR[tipo]} Se anota ${ingreso ? 'un ingreso' : tipo === 'GASTO' ? 'un gasto' : 'un movimiento'} de ${money(Number(monto), moneda)}${cuenta ? `${ingreso ? ' en ' : ' desde '}${cuenta}` : ''}.`;
  return (
    <Screen
      pie={
        <>
          {confirmar && montoOk ? <Nota>{queSeAnota}</Nota> : null}
          <Button
            title={confirmar ? (ingreso ? '✅ Sí, llegó' : '✅ Confirmar pago') : '💾 Guardar cambios'}
            onPress={guardar}
            loading={busy}
            disabled={!montoOk || !fechaOk}
          />
        </>
      }
    >
      <MontoBanda
        label={confirmar ? '¿Cuánto fue al final?' : '¿Cuánto será?'}
        value={monto}
        onChange={setMonto}
        moneda={moneda}
        color={colorAnotar(c, tipo)}
        emoji={EMOJI_ANOTAR[tipo]}
      />
      {confirmar ? (
        <Cuando label={ingreso ? '¿Cuándo llegó?' : tipo === 'GASTO' ? '¿Cuándo se pagó?' : '¿Cuándo se hizo?'} value={fecha} onChange={setFecha} />
      ) : (
        <DateField label="¿Para cuándo?" value={fecha} onChange={setFecha} />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
