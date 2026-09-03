import { useState } from 'react';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function CrearHogarScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const hogar = await api.post<HogarDTO>('/comandos/CrearHogar', { nombre: nombre.trim() }, token);
      // "usuario = Administrador" es resultado automático del comando.
      nav.reset('Dashboard', { hogarId: hogar.id });
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
      {nav.canGoBack && <LinkButton title="Volver" onPress={nav.back} />}
    </Screen>
  );
}
