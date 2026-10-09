import { useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, Screen } from '../ui';
import { BandaAcceso, CabeceraAcceso, EnlaceAcceso, PieAcceso } from '../ui/acceso';

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

  const errEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? '' : 'Escribe un correo válido.';
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
    <Screen
      pie={
        pideCodigo ? undefined : (
          <PieAcceso pregunta="¿Ya tienes cuenta?" accion="👋 Entrar" onPress={() => nav.go('Login')} />
        )
      }
    >
      <CabeceraAcceso titulo={pideCodigo ? '📬 Revisa tu correo' : '✨ Crea tu cuenta'} />

      {pideCodigo ? (
        <>
          <BandaAcceso emoji="📬">
            Te mandamos un código a {email.trim()} · vence en 15 min
          </BandaAcceso>
          <Field
            label="🔢 Escribe el código"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="6 dígitos"
            value={codigo}
            onChangeText={setCodigo}
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title="✅ Confirmar"
            onPress={() => crear(codigo.trim())}
            loading={loading}
            disabled={!/^\d{6}$/.test(codigo.trim())}
          />
          <EnlaceAcceso title="← Cambiar mis datos" onPress={() => setPideCodigo(false)} />
        </>
      ) : (
        <>
          <Field
            label="✏️ ¿Cómo te llamamos?"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            autoCapitalize="words"
            error={intento ? errNombre : undefined}
          />
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
            label="🔒 Elige una contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            error={intento ? errPassword : undefined}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="✨ Crear cuenta" onPress={() => crear()} loading={loading} />
        </>
      )}
    </Screen>
  );
}
