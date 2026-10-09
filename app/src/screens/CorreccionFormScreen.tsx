import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Text } from '../ui/Text';
import { Button, ErrorText, Field, MontoBanda, Screen, useC } from '../ui';

/**
 * Corregir el monto de una corrección de saldo (ajuste) o de un cambio de
 * valor (valorización) (plantillas de pantalla, R3): monto correcto y motivo.
 * Se registra una corrección enlazada; el original queda en el historial.
 */
const TIPOS = {
  ajuste: {
    titulo: 'Corregir la corrección de saldo',
    pregunta: '¿Cuál es el monto correcto?',
    emoji: '🔧',
    comando: 'CorregirAjustePatrimonial',
    cuerpo: (id: string, monto: number) => ({ ajusteId: id, nuevoMonto: monto }),
    aviso: 'Corrección guardada',
  },
  valorizacion: {
    titulo: 'Corregir el valor',
    pregunta: '¿Cuál es el valor correcto?',
    emoji: '📈',
    comando: 'CorregirValorizacion',
    cuerpo: (id: string, monto: number) => ({ valorizacionId: id, valorCorrecto: monto }),
    aviso: 'Valor corregido',
  },
} as const;

export function CorreccionFormScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const tipo = TIPOS[nav.route.params?.tipo as keyof typeof TIPOS];
  const id = nav.route.params?.id as string;
  const actual = nav.route.params?.montoActual as number;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  // El campo de monto no admite signo: se edita el valor absoluto y se conserva
  // el signo del ajuste (un ajuste que bajó el saldo sigue bajándolo).
  const signo = actual < 0 ? -1 : 1;
  const [monto, setMonto] = useState(String(Math.abs(actual)));
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useTitulo(tipo.titulo);

  const nuevo = signo * Number(monto);
  const cambia = monto.trim() !== '' && nuevo !== actual;
  const listo = cambia && motivo.trim().length >= 3;

  const guardar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/comandos/${tipo.comando}`, { ...tipo.cuerpo(id, nuevo), motivo: motivo.trim() }, token);
      toast.mostrar(tipo.aviso);
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen pie={<Button title="✏️ Guardar cambio" onPress={guardar} loading={busy} disabled={!listo} />}>
      <MontoBanda label={tipo.pregunta} value={monto} onChange={setMonto} moneda={moneda} color={c.primary} emoji={tipo.emoji}>
        <Text style={{ fontSize: 13, color: c.muted }}>
          {`Hoy dice ${money(actual, moneda)}${signo < 0 ? ' (baja el saldo, y el cambio también lo baja)' : ''}.`}
        </Text>
      </MontoBanda>
      <Field label="¿Por qué lo cambias?" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
