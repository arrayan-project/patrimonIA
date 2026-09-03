import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Button, colors, ErrorText, etiqueta, Field, LinkButton, Row, Screen, Title } from '../ui';

export function GestionHogarScreen() {
  const { token, usuario } = useSession();
  const { cerrarSesion } = useAuth();
  const toast = useToast();
  const nav = useNav();
  const hogarId = nav.route.params?.hogarId as string;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const h = await api.get<HogarDTO>(`/hogares/${hogarId}`, token);
      setHogar(h);
      setNombre(h.nombre);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [hogarId, token]);

  useCargaAlEnfocar(cargar);

  const run = async (fn: () => Promise<unknown>, salir = false) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (salir) nav.reset('Tabs');
      else await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
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

  const soyAdmin = hogar.miembros?.some(
    (m) => m.usuarioId === usuario.id && m.rol === 'ADMINISTRADOR',
  );

  return (
    <Screen onRefresh={cargar}>
      <Title>Gestionar hogar</Title>

      {soyAdmin && (
        <View style={styles.card}>
          <Field label="Nombre del hogar" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" />
          <Button
            title="Guardar nombre"
            loading={busy}
            onPress={() =>
              run(async () => {
                await api.post(
                  '/comandos/ActualizarDatosHogar',
                  { hogarId, nombre: nombre.trim() },
                  token,
                );
                toast.mostrar('Hogar actualizado');
              })
            }
          />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Miembros</Text>
        {hogar.miembros?.map((m) => (
          <View key={m.usuarioId} style={styles.miembro}>
            <Row left={m.nombre} right={etiqueta(m.rol)} />
            {soyAdmin && m.usuarioId !== usuario.id && (
              <View style={styles.acciones}>
                <Button
                  title={m.rol === 'ADMINISTRADOR' ? 'Hacer miembro' : 'Hacer admin'}
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    run(() =>
                      api.post(
                        '/comandos/AsignarRol',
                        {
                          hogarId,
                          usuarioId: m.usuarioId,
                          rol: m.rol === 'ADMINISTRADOR' ? 'MIEMBRO' : 'ADMINISTRADOR',
                        },
                        token,
                      ),
                    )
                  }
                />
                <Button
                  title="Remover"
                  variant="secondary"
                  loading={busy}
                  disabled={motivo.trim().length < 3}
                  onPress={() =>
                    run(() =>
                      api.post(
                        '/comandos/RemoverMiembro',
                        { hogarId, usuarioId: m.usuarioId, motivo: motivo.trim() },
                        token,
                      ),
                    )
                  }
                />
              </View>
            )}
          </View>
        ))}
        {soyAdmin && (
          <Field label="Motivo (para remover)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Salir</Text>
        <Button
          title="Salir del hogar"
          variant="danger"
          loading={busy}
          onPress={async () => {
            if (!(await confirmar('Salir del hogar', 'Dejarás de ver la consolidación y los objetivos del hogar. Tus elementos siguen siendo tuyos.', 'Salir')))
              return;
            await run(() => api.post('/comandos/SalirDeHogar', { hogarId }, token), true);
          }}
        />
        {soyAdmin && (
          <Button
            title="Eliminar hogar"
            variant="danger"
            loading={busy}
            disabled={motivo.trim().length < 3}
            onPress={async () => {
              if (!(await confirmar('Eliminar hogar', 'Se elimina el hogar y todas sus membresías. Los elementos patrimoniales de cada miembro sobreviven.', 'Eliminar')))
                return;
              await run(
                () => api.post('/comandos/EliminarHogar', { hogarId, motivo: motivo.trim() }, token),
                true,
              );
            }}
          />
        )}
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Cerrar sesión" onPress={cerrarSesion} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  miembro: { gap: 6, borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 8 },
  acciones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
