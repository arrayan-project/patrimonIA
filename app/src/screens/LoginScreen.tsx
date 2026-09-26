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
  const [intento, setIntento] = useState(false);

  const errEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? '' : 'Escribe un email válido.';
  const errPassword = password ? '' : 'Escribe tu contraseña.';

  const onSubmit = async () => {
    setIntento(true);
    if (errEmail || errPassword) return;
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
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.cl"
        error={intento ? errEmail : undefined}
      />
      <Field
        label="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Tu contraseña"
        error={intento ? errPassword : undefined}
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={onSubmit} loading={loading} />
      <LinkButton title="¿Olvidaste tu contraseña?" onPress={() => nav.go('RecuperarPassword')} />
      <LinkButton title="No tengo cuenta — registrarme" onPress={() => nav.go('Registro')} />
    </Screen>
  );
}
