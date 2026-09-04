import { useState } from 'react';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { Button, ErrorText, Field, Paragraph, Screen, Title } from '../ui';

export function CrearHogarScreen() {
  const { token } = useSession();
  const nav = useNav();
  const { key } = useIdempotencyKey();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const permitirSalida = useConfirmarDescarte(nombre.trim().length > 0 && !loading);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const hogar = await api.comando<HogarDTO>(
        '/comandos/CrearHogar',
        { nombre: nombre.trim() },
        token,
        key,
      );
      // "usuario = Administrador" es resultado automático del comando.
      permitirSalida();
      nav.reset('Tabs');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Crear hogar</Title>
      <Paragraph>Al crear el hogar quedas como su administrador.</Paragraph>

      <Field
        label="Nombre del hogar"
        value={nombre}
        onChangeText={setNombre}
        placeholder="p. ej. Familia Pérez"
        autoCapitalize="sentences"
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Crear hogar" onPress={onSubmit} loading={loading} disabled={!nombre.trim()} />
    </Screen>
  );
}
