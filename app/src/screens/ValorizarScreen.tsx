import { useState } from 'react';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import { Button, DateField, ErrorText, Migaja, MoneyField, Paragraph, Screen, Title } from '../ui';

export function ValorizarScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;

  const [valorNuevo, setValorNuevo] = useState('');
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);
  const permitirSalida = useConfirmarDescarte(
    (valorNuevo.trim() !== '' || fecha.trim() !== '') && !loading,
  );
  const errValor =
    valorNuevo.trim() !== '' && Number(valorNuevo) >= 0 ? '' : 'Ingresa el nuevo valor (0 o más).';

  const onSubmit = async () => {
    setIntento(true);
    if (errValor) return;
    setError('');
    setLoading(true);
    try {
      await api.post<ValorizacionDTO>(
        '/comandos/RegistrarValorizacion',
        {
          elementoId,
          valorNuevo: Number(valorNuevo),
          ...(fecha.trim() ? { fecha } : {}),
        },
        token,
      );
      toast.mostrar('Valorización registrada');
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
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Title>Registrar valorización</Title>
      {valorActual !== undefined && (
        <Paragraph>Valor vigente: {money(valorActual, moneda)}</Paragraph>
      )}
      <Paragraph>
        El nuevo valor reemplaza al vigente (no se suma). El cambio queda en el
        historial.
      </Paragraph>

      <MoneyField
        label="Nuevo valor"
        value={valorNuevo}
        onChange={setValorNuevo}
        moneda={moneda}
        error={intento ? errValor : undefined}
      />
      <DateField label="Fecha (opcional, por defecto hoy)" value={fecha} onChange={setFecha} optional />

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar valorización" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
