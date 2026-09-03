import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function RegistroScreen() {
  const { solicitarTokenRegistro, registrar } = useAuth();
  const nav = useNav();
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const crear = async (registroToken?: string) => {
    setError('');
    setLoading(true);
    try {
      // Pide (o reutiliza) el token de registro para este email.
      const token = registroToken ?? (await solicitarTokenRegistro(email.trim()));
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
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.cl"
        editable={!pideCodigo}
      />
      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Tu nombre" editable={!pideCodigo} />
      <Field
        label="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 8 caracteres"
        editable={!pideCodigo}
      />

      {pideCodigo ? (
        <>
          <Paragraph>Te enviamos un código de registro a {email.trim()}. Pégalo aquí:</Paragraph>
          <Field label="Código de registro" value={codigo} onChangeText={setCodigo} />
          <ErrorText>{error}</ErrorText>
          <Button
            title="Confirmar registro"
            onPress={() => crear(codigo.trim())}
            loading={loading}
            disabled={!codigo.trim()}
          />
          <LinkButton title="Volver" onPress={() => setPideCodigo(false)} />
        </>
      ) : (
        <>
          <ErrorText>{error}</ErrorText>
          <Button
            title="Crear cuenta"
            onPress={() => crear()}
            loading={loading}
            disabled={!email.trim() || !nombre.trim() || password.length < 8}
          />
          <LinkButton title="Ya tengo cuenta — iniciar sesión" onPress={() => nav.go('Login')} />
        </>
      )}
    </Screen>
  );
}
