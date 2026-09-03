import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function RegistroScreen() {
  const { registrar } = useAuth();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await registrar(email.trim(), nombre.trim(), password);
      // La sesión queda activa; AppFlow decide la siguiente pantalla.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Crear cuenta</Title>
      <Paragraph>Regístrate para empezar a usar PatrimonIA.</Paragraph>

      <Field
        label="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.cl"
      />
      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Tu nombre" />
      <Field
        label="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Crear cuenta" onPress={onSubmit} loading={loading} />
      <LinkButton title="Ya tengo cuenta — iniciar sesión" onPress={() => nav.go('Login')} />
    </Screen>
  );
}
