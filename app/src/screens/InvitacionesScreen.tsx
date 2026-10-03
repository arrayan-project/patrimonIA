import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type InvitacionDTO, type MembresiaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, Panel, Paragraph, Screen, Skeleton, useC, type Paleta } from '../ui';

export function InvitacionesScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
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
        <Paragraph>No tienes invitaciones pendientes por ahora.</Paragraph>
      ) : (
        invitaciones.map((inv) => (
          <Panel key={inv.id} gap={12}>
            <Text style={styles.hogar}>{inv.hogarNombre ?? 'Hogar'}</Text>
            <View style={styles.actions}>
              <Button
                title="Aceptar"
                onPress={() => aceptar(inv.id)}
                loading={actuando === inv.id}
              />
              <Button
                title="Rechazar"
                variant="secondary"
                onPress={() => rechazar(inv.id)}
                disabled={actuando === inv.id}
              />
            </View>
          </Panel>
        ))
      )}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  hogar: { fontSize: 17, fontWeight: '600', color: c.text },
  actions: { gap: 8 },
});
