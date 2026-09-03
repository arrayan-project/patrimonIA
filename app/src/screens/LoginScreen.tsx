import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function LoginScreen() {
  const { iniciarSesion } = useAuth();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Iniciar sesión</Title>
      <Paragraph>Bienvenido de vuelta a PatrimonIA.</Paragraph>

      <Field
        label="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.cl"
      />
      <Field
        label="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Tu contraseña"
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={onSubmit} loading={loading} />
      <LinkButton title="No tengo cuenta — registrarme" onPress={() => nav.go('Registro')} />
    </Screen>
  );
}
