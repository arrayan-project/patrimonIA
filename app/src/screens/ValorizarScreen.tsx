import { useState } from 'react';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function ValorizarScreen() {
  const { token } = useSession();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [valorNuevo, setValorNuevo] = useState('');
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post<ValorizacionDTO>(
        '/comandos/RegistrarValorizacion',
        {
          elementoId,
          valorNuevo: Number(valorNuevo),
          ...(fecha.trim() ? { fecha: fecha.trim() } : {}),
        },
        token,
      );
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Registrar valorización</Title>
      {valorActual !== undefined && (
        <Paragraph>Valor vigente: {money(valorActual, moneda)}</Paragraph>
      )}
      <Paragraph>
        El nuevo valor reemplaza al vigente (no se suma). El cambio queda en el
        historial.
      </Paragraph>

      <Field
        label={`Nuevo valor (${moneda})`}
        keyboardType="numeric"
        value={valorNuevo}
        onChangeText={setValorNuevo}
        placeholder="0"
      />
      <Field
        label="Fecha (opcional, YYYY-MM-DD)"
        value={fecha}
        onChangeText={setFecha}
        placeholder="hoy"
      />

      <ErrorText>{error}</ErrorText>
      <Button
        title="Registrar valorización"
        onPress={onSubmit}
        loading={loading}
        disabled={!(Number(valorNuevo) >= 0 && valorNuevo.trim() !== '')}
      />
      {nav.canGoBack && <LinkButton title="Volver" onPress={nav.back} />}
    </Screen>
  );
}
