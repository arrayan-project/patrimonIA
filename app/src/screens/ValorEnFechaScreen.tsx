import { useState } from 'react';
import { api, ApiError, type ValorHistoricoElementoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav } from '../navigation/navigator';
import { Button, contadorPasos, DateField, Dato, Datos, ErrorText, fechaLegible, Nota, Screen } from '../ui';

/**
 * ¿Cuánto valía una cuenta o bien en otra fecha? (plantillas de pantalla, R3:
 * la consulta sale del Detalle, que no lleva campos). Solo consulta.
 */
export function ValorEnFechaScreen() {
  const { token } = useSession();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string;
  const [fecha, setFecha] = useState('');
  const [valor, setValor] = useState<ValorHistoricoElementoDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim());

  const consultar = async () => {
    setBusy(true);
    setError('');
    try {
      setValor(
        await api.get<ValorHistoricoElementoDTO>(
          `/elementos-patrimoniales/${elementoId}/valor-historico?fecha=${fecha.trim()}`,
          token,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const paso = contadorPasos();
  return (
    <Screen pie={<Button title="Consultar" onPress={consultar} loading={busy} disabled={!fechaOk} />}>
      <DateField
        label="¿A qué fecha?"
        paso={paso({ hecho: fechaOk })}
        value={fecha}
        onChange={(f) => {
          setFecha(f);
          setValor(null);
        }}
      />
      {valor &&
        (valor.existia ? (
          <Datos>
            <Dato etiqueta={`Al ${fechaLegible(valor.fecha)}`} valor={money(valor.valor, valor.moneda)} />
          </Datos>
        ) : (
          <Nota>En esa fecha aún no existía o ya había salido del patrimonio.</Nota>
        ))}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
