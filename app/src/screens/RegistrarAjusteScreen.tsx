import { useState } from 'react';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { GLOSARIO } from '../labels';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  aISO,
  Ayuda,
  Button,
  DateField,
  ErrorText,
  Field,
  LinkButton,
  Migaja,
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
  const contexto = nav.route.params?.contexto as string | undefined;
  const modoInteres = nav.route.params?.modoInteres === true;
  const sentidoInicial = (nav.route.params?.sentidoInicial as 'Mayor' | 'Menor' | undefined) ?? 'Menor';
  const magnitudInicial = nav.route.params?.magnitudInicial as number | undefined;
  const motivoInicial = (nav.route.params?.motivoInicial as string | undefined) ?? '';

  const [direccion, setDireccion] = useState<'Mayor' | 'Menor'>(sentidoInicial);
  const [magnitud, setMagnitud] = useState(
    magnitudInicial != null && magnitudInicial > 0 ? String(Math.round(magnitudInicial)) : '',
  );
  const [fecha, setFecha] = useState(aISO(new Date()));
  const [motivo, setMotivo] = useState(motivoInicial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);

  const monto = (direccion === 'Menor' ? -1 : 1) * (Number(magnitud) || 0);
  const errMagnitud = Number(magnitud) > 0 ? '' : 'Ingresa la diferencia (mayor a 0).';
  const errMotivo = motivo.trim().length >= 3 ? '' : 'Explica brevemente el motivo (mínimo 3 letras).';
  const permitirSalida = useConfirmarDescarte(
    (Number(magnitud) > 0 || motivo.trim().length > 0) && !loading,
  );

  const onSubmit = async () => {
    setIntento(true);
    if (errMagnitud || errMotivo) return;
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
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Title>{modoInteres ? 'Registrar interés' : 'Registrar ajuste patrimonial'}</Title>
      {valorActual !== undefined && (
        <Paragraph>Valor vigente: {money(valorActual, moneda)}</Paragraph>
      )}
      <Ayuda>
        {modoInteres
          ? 'El interés de una deuda o crédito se registra como un ajuste que aumenta el saldo. El monto sugerido es saldo × tasa anual ÷ 12 — ajústalo al período real (mora, refinanciación, etc.).'
          : GLOSARIO.ajuste}
      </Ayuda>

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
        error={intento ? errMagnitud : undefined}
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
        error={intento ? errMotivo : undefined}
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar ajuste" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
