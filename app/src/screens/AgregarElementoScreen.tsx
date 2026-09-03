import { useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Segmented, Title } from '../ui';

const CATEGORIAS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO'] as const;

export function AgregarElementoScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('cuenta_corriente');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('LIQUIDEZ');
  const [valorInicial, setValorInicial] = useState('0');
  const [moneda, setMoneda] = useState('CLP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post<ElementoPatrimonialDTO>(
        '/comandos/RegistrarElementoPatrimonial',
        {
          nombre: nombre.trim(),
          tipo: tipo.trim(),
          categoriaFuncional: categoria,
          valorInicial: Number(valorInicial) || 0,
          moneda: moneda.trim().toUpperCase(),
          participaValorLiquido: categoria === 'LIQUIDEZ',
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
      <Title>Agregar elemento patrimonial</Title>
      <Paragraph>Una cuenta, un activo, una inversión. Quedas como propietario al 100%.</Paragraph>

      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Cuenta Corriente" autoCapitalize="sentences" />
      <Field label="Tipo" value={tipo} onChangeText={setTipo} placeholder="cuenta_corriente" />
      <Segmented label="Categoría funcional" options={CATEGORIAS} value={categoria} onChange={setCategoria} />
      <Field
        label="Valor inicial"
        keyboardType="numeric"
        value={valorInicial}
        onChangeText={setValorInicial}
        placeholder="0"
      />
      <Field label="Moneda (ISO 4217)" value={moneda} onChangeText={setMoneda} placeholder="CLP" maxLength={3} />

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar elemento" onPress={onSubmit} loading={loading} disabled={!nombre.trim()} />
      {nav.canGoBack && <LinkButton title="Volver" onPress={nav.back} />}
    </Screen>
  );
}
