import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { aISO, AmountInput, Button, contadorPasos, Cuando, DateField, ErrorText, Nota, Screen } from '../ui';

/**
 * Editar un movimiento programado o confirmar su pago (plantillas de pantalla,
 * R3): las dos preguntan monto y fecha. Al confirmar, se registra el movimiento
 * real con lo que efectivamente pasó.
 */
export function ProgramadoFormScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const modo = nav.route.params?.modo as 'editar' | 'confirmar';
  const movimientoId = nav.route.params?.movimientoId as string;
  const planificado = nav.route.params?.monto as number;
  const moneda = nav.route.params?.moneda as string;
  const confirmar = modo === 'confirmar';

  const [monto, setMonto] = useState(String(planificado));
  // Al confirmar, lo normal es que se pagó hoy; al editar, se parte de la fecha programada.
  const [fecha, setFecha] = useState(confirmar ? aISO(new Date()) : (nav.route.params?.fecha as string).slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useTitulo(confirmar ? 'Confirmar pago' : 'Editar programado');

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
        toast.mostrar('Pago confirmado');
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

  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <>
          {confirmar && montoOk ? <Nota>{`Se registra un movimiento real por ${money(Number(monto), moneda)}.`}</Nota> : null}
          <Button
            title={confirmar ? 'Confirmar pago' : 'Guardar cambios'}
            onPress={guardar}
            loading={busy}
            disabled={!montoOk || !fechaOk}
          />
        </>
      }
    >
      <AmountInput
        label={confirmar ? '¿Cuánto fue al final?' : '¿Cuánto será?'}
        paso={paso({ hecho: montoOk })}
        value={monto}
        onChange={setMonto}
        moneda={moneda}
      />
      {confirmar ? (
        <Cuando label="¿Cuándo se pagó?" paso={paso({ hecho: fechaOk })} value={fecha} onChange={setFecha} />
      ) : (
        <DateField label="¿Para cuándo?" paso={paso({ hecho: fechaOk })} value={fecha} onChange={setFecha} />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
