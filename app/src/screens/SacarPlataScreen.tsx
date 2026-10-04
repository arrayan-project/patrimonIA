import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Button, contadorPasos, Elegir, ErrorText, Field, Nota, Screen } from '../ui';

/**
 * Sacar la plata ahorrada en una cuenta (plantillas de pantalla, R3): libera
 * esa reserva completa. La plata no sale de la cuenta; vuelve a quedar libre.
 */
export interface ReservaParaSacar {
  id: string;
  cuenta: string;
  monto: number;
}

export function SacarPlataScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const reservas = nav.route.params?.reservas as ReservaParaSacar[];
  const moneda = nav.route.params?.moneda as string;
  const deUnaMeta = nav.route.params?.deUnaMeta as boolean;

  const [reservaId, setReservaId] = useState<string | null>(reservas.length === 1 ? reservas[0].id : null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useTitulo(deUnaMeta ? 'Sacar de la meta' : 'Sacar');

  const elegida = reservas.find((r) => r.id === reservaId);
  const listo = !!elegida && motivo.trim().length >= 3;

  const sacar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/comandos/LiberarReserva', { reservaId, motivo: motivo.trim() }, token);
      toast.mostrar('Plata liberada');
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
          {elegida ? (
            <Nota>{`${money(elegida.monto, moneda)} vuelven a quedar libres en ${elegida.cuenta}. No salen de la cuenta.`}</Nota>
          ) : null}
          <Button
            title={elegida ? `Sacar ${money(elegida.monto, moneda)}` : 'Sacar'}
            onPress={sacar}
            loading={busy}
            disabled={!listo}
          />
        </>
      }
    >
      <Elegir
        label="¿De qué cuenta?"
        paso={paso({ hecho: !!elegida })}
        placeholder="Elegir cuenta"
        value={reservaId}
        options={reservas.map((r) => ({ value: r.id, label: r.cuenta, sub: money(r.monto, moneda) }))}
        onChange={setReservaId}
      />
      <Field
        label="¿Por qué la sacas?"
        paso={paso({ hecho: motivo.trim().length >= 3 })}
        value={motivo}
        onChangeText={setMotivo}
        autoCapitalize="sentences"
      />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
