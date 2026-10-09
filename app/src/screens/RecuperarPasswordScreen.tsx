import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Field, Screen } from '../ui';
import { BandaAcceso, CabeceraAcceso, EnlaceAcceso, PieAcceso } from '../ui/acceso';

type Paso = 'email' | 'codigo' | 'listo';

/**
 * Recuperar contraseña olvidada (GAPS.md G31): pide el email, el backend envía
 * un código de 6 dígitos (un solo uso, 15 min, 5 intentos) y con él se elige la
 * nueva contraseña.
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

  const errEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? '' : 'Escribe un correo válido.';
  const errCodigo = /^\d{6}$/.test(codigo.trim()) ? '' : 'Escribe los 6 dígitos que te enviamos.';
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
      await api.post('/auth/reset-password', {
        email: email.trim(),
        codigo: codigo.trim(),
        nuevaPassword: password,
      });
      setPaso('listo');
    });
  };

  if (paso === 'listo') {
    return (
      <Screen>
        <CabeceraAcceso titulo="✅ Listo, ya tienes contraseña nueva" />
        <BandaAcceso emoji="🔐">Cerramos tu sesión en todos tus teléfonos.</BandaAcceso>
        <Button title="👋 Entrar" onPress={() => nav.go('Login')} />
      </Screen>
    );
  }

  return (
    <Screen
      pie={<PieAcceso pregunta="¿Te acordaste?" accion="👋 Entrar" onPress={() => nav.go('Login')} />}
    >
      <CabeceraAcceso titulo="🔑 ¿Olvidaste tu contraseña?" />

      {paso === 'email' ? (
        <>
          <BandaAcceso emoji="📬">Te mandamos un código a tu correo para elegir una nueva.</BandaAcceso>
          <Field
            label="📧 Tu correo"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.cl"
            error={intento ? errEmail : undefined}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="📬 Mandar código" onPress={solicitar} loading={loading} />
        </>
      ) : (
        <>
          <BandaAcceso emoji="📬">
            Si {email.trim()} tiene cuenta, te llega un código · vence en 15 min
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
            error={intento ? errCodigo : undefined}
          />
          <Field
            label="🔒 Elige tu nueva contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            error={intento ? errPassword : undefined}
          />
          <ErrorText>{error}</ErrorText>
          <Button title="🔒 Cambiar contraseña" onPress={restablecer} loading={loading} />
          <EnlaceAcceso title="No me llegó, pedir otro" onPress={() => setPaso('email')} />
        </>
      )}
    </Screen>
  );
}
