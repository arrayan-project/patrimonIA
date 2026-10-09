import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type InvitacionDTO, type MembresiaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, EmptyState, ErrorText, fechaLegible, Panel, Screen, Skeleton, tinte, useC, type Paleta } from '../ui';

export function InvitacionesScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const [invitaciones, setInvitaciones] = useState<InvitacionDTO[] | null>(null);
  const [error, setError] = useState('');
  const [actuando, setActuando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setInvitaciones(
        await api.get<InvitacionDTO[]>('/usuarios/me/invitaciones?estado=PENDIENTE', token),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const aceptar = async (id: string) => {
    setActuando(id);
    setError('');
    try {
      await api.post<MembresiaDTO>('/comandos/AceptarInvitacion', { invitacionId: id }, token);
      nav.reset('Tabs');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
      setActuando(null);
    }
  };

  const rechazar = async (id: string) => {
    setActuando(id);
    setError('');
    try {
      await api.post('/comandos/RechazarInvitacion', { invitacionId: id }, token);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setActuando(null);
    }
  };

  return (
    <Screen onRefresh={cargar}>
      <ErrorText>{error}</ErrorText>

      {invitaciones === null ? (
        <Skeleton />
      ) : invitaciones.length === 0 ? (
        <EmptyState
          emoji="📭"
          titulo="Todavía no te invitan"
          descripcion={`Pídele a quien te quiera sumar que te invite con tu correo: ${usuario.email}`}
        />
      ) : (
        invitaciones.map((inv) => (
          <Panel key={inv.id} gap={12}>
            <View style={styles.cabeza}>
              <View style={styles.circulo}>
                <Text style={styles.emoji}>🏠</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.hogar}>{inv.hogarNombre ?? 'Hogar'}</Text>
                <Text style={styles.sub}>Te invitaron · {fechaLegible(inv.createdAt)}</Text>
              </View>
            </View>
            <Button
              title="✅ Unirme"
              onPress={() => aceptar(inv.id)}
              loading={actuando === inv.id}
            />
            <Pressable
              onPress={() => rechazar(inv.id)}
              disabled={actuando === inv.id}
              accessibilityRole="button"
              style={({ pressed }) => [styles.noGracias, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.noGraciasTxt}>No, gracias</Text>
            </Pressable>
          </Panel>
        ))
      )}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circulo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tinte(c.primary, 0.14),
  },
  emoji: { fontSize: 24 },
  hogar: { fontSize: 17, fontWeight: '800', color: c.text },
  sub: { fontSize: 13, color: c.muted },
  noGracias: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  noGraciasTxt: { fontSize: 15, fontWeight: '700', color: c.muted },
});
