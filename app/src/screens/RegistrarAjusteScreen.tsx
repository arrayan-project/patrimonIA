import { useState } from 'react';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function RegistrarAjusteScreen() {
  const { token } = useSession();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post<AjustePatrimonialDTO>(
        '/comandos/RegistrarAjustePatrimonial',
        { elementoId, monto: Number(monto), motivo: motivo.trim() },
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
      <Title>Registrar ajuste patrimonial</Title>
      {valorActual !== undefined && (
        <Paragraph>Valor vigente: {money(valorActual, moneda)}</Paragraph>
      )}
      <Paragraph>
        Solo cuando no puedes reconstruir la causa exacta de una diferencia. Monto con
        signo: negativo si el valor real es menor, positivo si es mayor.
      </Paragraph>

      <Field
        label={`Monto del ajuste (${moneda})`}
        keyboardType="numbers-and-punctuation"
        value={monto}
        onChangeText={setMonto}
        placeholder="-3000"
      />
      <Field
        label="Motivo (obligatorio)"
        value={motivo}
        onChangeText={setMotivo}
        placeholder="Por qué hay una diferencia"
        autoCapitalize="sentences"
      />

      <ErrorText>{error}</ErrorText>
      <Button
        title="Registrar ajuste"
        onPress={onSubmit}
        loading={loading}
        disabled={motivo.trim().length < 3 || monto.trim() === '' || Number(monto) === 0}
      />
      {nav.canGoBack && <LinkButton title="Volver" onPress={nav.back} />}
    </Screen>
  );
}
