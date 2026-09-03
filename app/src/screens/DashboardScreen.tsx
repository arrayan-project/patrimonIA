import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type HogarDTO, type InvitacionDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, colors, ErrorText, Field, LinkButton, Paragraph, Screen, Title } from '../ui';

export function DashboardScreen() {
  const { token, usuario } = useSession();
  const { cerrarSesion } = useAuth();
  const nav = useNav();

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [invitando, setInvitando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      if (hogares.length === 0) {
        nav.reset('Bienvenida');
        return;
      }
      // Esqueleto: se muestra el primer hogar. El selector multi-hogar llega después.
      setHogar(await api.get<HogarDTO>(`/hogares/${hogares[0].id}`, token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, nav]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const esAdmin = hogar?.miembros?.some(
    (m) => m.usuarioId === usuario.id && m.rol === 'ADMINISTRADOR',
  );

  const invitar = async () => {
    if (!hogar) return;
    setInvitando(true);
    setError('');
    setAviso('');
    try {
      await api.post<InvitacionDTO>(
        '/comandos/InvitarMiembro',
        { hogarId: hogar.id, emailInvitado: email.trim() },
        token,
      );
      setAviso(`Invitación enviada a ${email.trim()}`);
      setEmail('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setInvitando(false);
    }
  };

  if (!hogar) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{hogar.nombre}</Title>
      <Paragraph>Moneda de consolidación: {hogar.monedaConsolidacion}</Paragraph>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Miembros</Text>
        {hogar.miembros?.map((m) => (
          <View key={m.usuarioId} style={styles.miembro}>
            <Text style={styles.miembroNombre}>{m.nombre}</Text>
            <Text style={styles.miembroRol}>{m.rol}</Text>
          </View>
        ))}
      </View>

      {esAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitar a un miembro</Text>
          <Field
            label="Email del invitado"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="persona@email.cl"
          />
          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
          <Button
            title="Enviar invitación"
            onPress={invitar}
            loading={invitando}
            disabled={!email.trim()}
          />
        </View>
      )}

      <ErrorText>{error}</ErrorText>

      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Aún no hay elementos patrimoniales.</Text>
        <Text style={styles.emptyHint}>Agregar tu primer elemento patrimonial (próxima fase)</Text>
      </View>

      <LinkButton title="Actualizar" onPress={() => void cargar()} />
      <LinkButton title="Cerrar sesión" onPress={cerrarSesion} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  miembro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  miembroNombre: { fontSize: 15, color: colors.text },
  miembroRol: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  aviso: { color: colors.primary, fontSize: 14 },
  emptyState: {
    backgroundColor: colors.faint,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    gap: 4,
  },
  emptyText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: colors.muted },
});
