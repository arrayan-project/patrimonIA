import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

type Paso = 'email' | 'codigo' | 'listo';

/**
 * Recuperar contraseña olvidada (GAPS.md G31): pide el email, el backend envía
 * un código (token de un solo uso, 30 min) y con él se elige la nueva contraseña.
 * Al completarse, el backend cierra todas las sesiones abiertas.
 */
export function RecuperarPasswordScreen() {
  const nav = useNav();
  const [paso, setPaso] = useState<Paso>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);

  const errEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? '' : 'Escribe un email válido.';
  const errCodigo = codigo.trim() ? '' : 'Pega el código que te enviamos.';
  const errPassword = password.length >= 8 ? '' : 'Mínimo 8 caracteres.';

  const ejecutar = async (accion: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const solicitar = () => {
    setIntento(true);
    if (errEmail) return;
    void ejecutar(async () => {
      await api.post('/auth/solicitar-reset-password', { email: email.trim() });
      setIntento(false);
      setPaso('codigo');
    });
  };

  const restablecer = () => {
    setIntento(true);
    if (errCodigo || errPassword) return;
    void ejecutar(async () => {
      await api.post('/auth/reset-password', { token: codigo.trim(), nuevaPassword: password });
      setPaso('listo');
    });
  };

  if (paso === 'listo') {
    return (
      <Screen>
        <Title>Contraseña actualizada</Title>
        <Paragraph>
          Ya puedes iniciar sesión con tu nueva contraseña. Por seguridad, cerramos la sesión en
          todos tus dispositivos.
        </Paragraph>
        <Button title="Iniciar sesión" onPress={() => nav.go('Login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Recuperar contraseña</Title>

      {paso === 'email' ? (
        <>
          <Paragraph>Escribe el email de tu cuenta y te enviaremos un código.</Paragraph>
          <Field
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.cl"
            error={intento ? errEmail : undefined}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Enviar código" onPress={solicitar} loading={loading} />
        </>
      ) : (
        <>
          <Paragraph>
            Si {email.trim()} tiene una cuenta, te llegará un código que vence en 30 minutos. Pégalo
            aquí y elige tu nueva contraseña.
          </Paragraph>
          <Field
            label="Código"
            autoCapitalize="none"
            value={codigo}
            onChangeText={setCodigo}
            error={intento ? errCodigo : undefined}
          />
          <Field
            label="Nueva contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            error={intento ? errPassword : undefined}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Cambiar contraseña" onPress={restablecer} loading={loading} />
          <LinkButton title="No me llegó — volver a pedirlo" onPress={() => setPaso('email')} />
        </>
      )}

      <LinkButton title="Volver a iniciar sesión" onPress={() => nav.go('Login')} />
    </Screen>
  );
}
