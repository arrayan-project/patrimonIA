import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function RegistroScreen() {
  const { solicitarTokenRegistro, verificarCodigoRegistro, registrar } = useAuth();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);

  const errEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? '' : 'Escribe un email válido.';
  const errNombre = nombre.trim() ? '' : 'Escribe tu nombre.';
  const errPassword = password.length >= 8 ? '' : 'Mínimo 8 caracteres.';

  /** Sin código pide el token de registro; con código lo canjea por el token (G4). */
  const crear = async (codigoEmail?: string) => {
    if (!codigoEmail) {
      setIntento(true);
      if (errEmail || errNombre || errPassword) return;
    }
    setError('');
    setLoading(true);
    try {
      const token = codigoEmail
        ? await verificarCodigoRegistro(email.trim(), codigoEmail)
        : await solicitarTokenRegistro(email.trim());
      if (!token) {
        // El backend lo envió por email — pedimos el código.
        setPideCodigo(true);
        return;
      }
      await registrar(email.trim(), nombre.trim(), password, token);
      // sesión activa; RootNavigator decide la siguiente pantalla
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
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.cl"
        editable={!pideCodigo}
        error={intento ? errEmail : undefined}
      />
      <Field
        label="Nombre"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Tu nombre"
        editable={!pideCodigo}
        error={intento ? errNombre : undefined}
      />
      <Field
        label="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        editable={!pideCodigo}
        error={intento ? errPassword : undefined}
      />

      {pideCodigo ? (
        <>
          <Paragraph>
            Te enviamos un código de 6 dígitos a {email.trim()} (vence en 15 minutos). Escríbelo
            aquí:
          </Paragraph>
          <Field
            label="Código de registro"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            value={codigo}
            onChangeText={setCodigo}
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title="Confirmar registro"
            onPress={() => crear(codigo.trim())}
            loading={loading}
            disabled={!/^\d{6}$/.test(codigo.trim())}
          />
          <LinkButton title="Volver" onPress={() => setPideCodigo(false)} />
        </>
      ) : (
        <>
          <ErrorText>{error}</ErrorText>
          <Button title="Crear cuenta" onPress={() => crear()} loading={loading} />
          <LinkButton title="Ya tengo cuenta — iniciar sesión" onPress={() => nav.go('Login')} />
        </>
      )}
    </Screen>
  );
}
