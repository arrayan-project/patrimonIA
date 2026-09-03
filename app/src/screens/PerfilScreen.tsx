import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type UsuarioDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Button, colors, ErrorText, Field, Paragraph, Row, Screen, Title } from '../ui';

export function PerfilScreen() {
  const { token } = useSession();
  const { cerrarSesion } = useAuth();
  const toast = useToast();
  const nav = useNav();

  const [me, setMe] = useState<UsuarioDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<UsuarioDTO>('/usuarios/me', token)
      .then((u) => {
        setMe(u);
        setNombre(u.nombre);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  const guardar = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/comandos/ActualizarDatosUsuario', { nombre: nombre.trim() }, token);
      toast.mostrar('Perfil actualizado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const desactivar = async () => {
    if (
      !(await confirmar(
        'Desactivar mi cuenta',
        'No podrás volver a iniciar sesión. Se cerrará la sesión ahora.',
        'Desactivar',
      ))
    )
      return;
    setBusy(true);
    setError('');
    try {
      await api.post('/comandos/DesactivarUsuario', { motivo: motivo.trim() }, token);
      cerrarSesion();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Mi perfil</Title>
      {me && (
        <View style={styles.card}>
          <Row left="Email" right={me.email} />
          <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" />
          <Button title="Guardar" onPress={guardar} loading={busy} disabled={!nombre.trim()} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Desactivar cuenta</Text>
        <Paragraph>
          Tus elementos patrimoniales y membresías históricas se conservan, pero no podrás
          volver a iniciar sesión.
        </Paragraph>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        <Button
          title="Desactivar mi cuenta"
          variant="danger"
          onPress={desactivar}
          loading={busy}
          disabled={motivo.trim().length < 3}
        />
      </View>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
