import { useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useToast } from '../ui/Toast';
import {
  Button,
  ErrorText,
  Field,
  LinkButton,
  MoneyField,
  Paragraph,
  Screen,
  Segmented,
  Title,
} from '../ui';

const CATEGORIAS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const;

export function AgregarElementoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('cuenta_corriente');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('LIQUIDEZ');
  const [valorInicial, setValorInicial] = useState('0');
  const [valorPendiente, setValorPendiente] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [valorizable, setValorizable] = useState<'No' | 'Sí'>('No');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';

  const onCategoria = (c: (typeof CATEGORIAS)[number]) => {
    setCategoria(c);
    setValorizable(c === 'ACTIVO' || c === 'INVERSION' ? 'Sí' : 'No');
  };

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.comando<ElementoPatrimonialDTO>(
        '/comandos/RegistrarElementoPatrimonial',
        {
          nombre: nombre.trim(),
          tipo: tipo.trim(),
          categoriaFuncional: categoria,
          moneda: moneda.trim().toUpperCase(),
          ...(esDeudaOCredito
            ? { valorPendiente: Number(valorPendiente) || 0 }
            : {
                valorInicial: Number(valorInicial) || 0,
                participaValorLiquido: categoria === 'LIQUIDEZ',
                admiteValorizacion: valorizable === 'Sí',
              }),
        },
        token,
        key,
      );
      toast.mostrar('Elemento agregado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Agregar elemento patrimonial</Title>
      <Paragraph>Una cuenta, un activo, una inversión. Quedas como propietario al 100%.</Paragraph>

      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Cuenta Corriente" autoCapitalize="sentences" />
      <Field label="Tipo" value={tipo} onChangeText={setTipo} placeholder="cuenta_corriente" />
      <Segmented label="Categoría funcional" options={CATEGORIAS} value={categoria} onChange={onCategoria} />
      {esDeudaOCredito ? (
        <>
          <MoneyField
            label={categoria === 'DEUDA' ? 'Monto que debes' : 'Monto que te deben'}
            value={valorPendiente}
            onChange={setValorPendiente}
            moneda={moneda.trim().toUpperCase() || undefined}
          />
          <Paragraph>
            {categoria === 'DEUDA'
              ? 'Resta a tu patrimonio. Se salda con transferencias hacia esta deuda.'
              : 'Suma a tu patrimonio. Se reduce cuando te pagan (transferencia hacia esta cuenta).'}
          </Paragraph>
        </>
      ) : (
        <>
          <MoneyField
            label="Valor inicial"
            value={valorInicial}
            onChange={setValorInicial}
            moneda={moneda.trim().toUpperCase() || undefined}
          />
          <Segmented
            label="¿Se valoriza en el tiempo? (inmuebles, inversiones)"
            options={['No', 'Sí'] as const}
            value={valorizable}
            onChange={setValorizable}
          />
          <Paragraph>No se puede cambiar después de crear el elemento.</Paragraph>
        </>
      )}
      <Field label="Moneda (ISO 4217)" value={moneda} onChangeText={setMoneda} placeholder="CLP" maxLength={3} />

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar elemento" onPress={onSubmit} loading={loading} disabled={!nombre.trim()} />
      {nav.canGoBack && <LinkButton title="Volver" onPress={nav.back} />}
    </Screen>
  );
}
