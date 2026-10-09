import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, Screen } from '../ui';
import { CabeceraAcceso, EnlaceAcceso, PieAcceso } from '../ui/acceso';

export function LoginScreen() {
  const { iniciarSesion } = useAuth();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);

  const errEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? '' : 'Escribe un correo válido.';
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
    <Screen
      pie={<PieAcceso pregunta="¿Primera vez?" accion="✨ Crear cuenta" onPress={() => nav.go('Registro')} />}
    >
      <CabeceraAcceso titulo="👋 ¡Hola de nuevo!" />

      <Field
        label="📧 Tu correo"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.cl"
        error={intento ? errEmail : undefined}
      />
      <Field
        label="🔒 Tu contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Tu contraseña"
        error={intento ? errPassword : undefined}
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Entrar" onPress={onSubmit} loading={loading} />
      <EnlaceAcceso title="¿Olvidaste tu contraseña?" onPress={() => nav.go('RecuperarPassword')} />
    </Screen>
  );
}
