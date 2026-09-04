import { useState } from 'react';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  aISO,
  Button,
  DateField,
  ErrorText,
  Field,
  LinkButton,
  MoneyField,
  Paragraph,
  Screen,
  Segmented,
  Title,
} from '../ui';

export function RegistrarAjusteScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [direccion, setDireccion] = useState<'Mayor' | 'Menor'>('Menor');
  const [magnitud, setMagnitud] = useState('');
  const [fecha, setFecha] = useState(aISO(new Date()));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const monto = (direccion === 'Menor' ? -1 : 1) * (Number(magnitud) || 0);
  const permitirSalida = useConfirmarDescarte(
    (Number(magnitud) > 0 || motivo.trim().length > 0) && !loading,
  );

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post<AjustePatrimonialDTO>(
        '/comandos/RegistrarAjustePatrimonial',
        { elementoId, monto, motivo: motivo.trim(), fecha },
        token,
      );
      toast.mostrar('Ajuste registrado');
      permitirSalida();
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
        Solo cuando no puedes reconstruir la causa exacta de una diferencia entre el valor
        registrado y el real.
      </Paragraph>

      <Segmented
        label="El valor real es…"
        options={['Menor', 'Mayor'] as const}
        value={direccion}
        onChange={setDireccion}
      />
      <MoneyField
        label={`Diferencia (${moneda})`}
        value={magnitud}
        onChange={setMagnitud}
        moneda={moneda}
      />
      {valorActual !== undefined && Number(magnitud) > 0 && (
        <Paragraph>
          Nuevo valor: {money(valorActual + monto, moneda)}
        </Paragraph>
      )}
      <DateField label="Fecha" value={fecha} onChange={setFecha} />
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
        disabled={motivo.trim().length < 3 || !(Number(magnitud) > 0)}
      />
    </Screen>
  );
}
