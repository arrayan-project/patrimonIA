import { useState } from 'react';
import { Text } from '../ui/Text';
import { api, ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Button, Dato, Datos, Elegir, ErrorText, Field, Nota, Screen, useC } from '../ui';

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
  const c = useC();
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
  const ahorrado = reservas.reduce((s, r) => s + r.monto, 0);
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

  // G35: sin numerar; en vez de explicar, la resta (se saca todo lo de esa cuenta).
  return (
    <Screen
      pie={
        <Button
          title={elegida ? `💸 Sacar ${money(elegida.monto, moneda)}` : '💸 Sacar'}
          onPress={sacar}
          loading={busy}
          disabled={!listo}
        />
      }
    >
      {reservas.length > 1 && (
        <Elegir
          label="¿De qué cuenta?"
          placeholder="Elegir cuenta"
          value={reservaId}
          options={reservas.map((r) => ({ value: r.id, label: r.cuenta, sub: money(r.monto, moneda) }))}
          onChange={setReservaId}
        />
      )}
      {elegida && (
        <>
          <Datos>
            <Dato etiqueta={deUnaMeta ? '🐷 En la meta' : '🐷 Ahorrado'} valor={money(ahorrado, moneda)} />
            <Dato
              etiqueta={`💸 Sacas de ${elegida.cuenta}`}
              valor={<Text style={{ fontWeight: '700', color: c.danger }}>{`− ${money(elegida.monto, moneda)}`}</Text>}
            />
            <Dato etiqueta="✅ Queda ahorrado" valor={money(ahorrado - elegida.monto, moneda)} />
          </Datos>
          <Nota>{`La plata no se mueve: vuelve a quedar libre en ${elegida.cuenta}.`}</Nota>
        </>
      )}
      <Field
        label="¿Por qué la sacas?"
        value={motivo}
        onChangeText={setMotivo}
        autoCapitalize="sentences"
        placeholder="p. ej. Pagué el dentista"
      />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
