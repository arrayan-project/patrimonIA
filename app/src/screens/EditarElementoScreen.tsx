import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Button, colors, ErrorText, Field, LinkButton, Paragraph, Screen, Segmented, Title } from '../ui';

const VIS = ['PRIVADA', 'COMPARTIDA', 'FAMILIAR'] as const;

export function EditarElementoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;

  const [el, setEl] = useState<ElementoPatrimonialDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [visibilidad, setVisibilidad] = useState<(typeof VIS)[number]>('PRIVADA');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token)
      .then((e) => {
        setEl(e);
        setNombre(e.nombre);
        setTipo(e.tipo);
        setVisibilidad(e.visibilidad as (typeof VIS)[number]);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [elementoId, token]);

  const run = async (fn: () => Promise<unknown>, aviso?: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (aviso) toast.mostrar(aviso);
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!el) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
        <LinkButton title="Volver" onPress={nav.back} />
      </Screen>
    );
  }

  const activo = el.estado === 'ACTIVO';

  return (
    <Screen>
      <Title>Editar {el.nombre}</Title>

      {activo && (
        <View style={styles.card}>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" />
          <Field label="Tipo" value={tipo} onChangeText={setTipo} />
          <Button
            title="Guardar datos"
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/ActualizarDatosElementoPatrimonial',
                  { elementoId, nombre: nombre.trim(), tipo: tipo.trim() },
                  token,
                ),
              )
            }
            loading={busy}
          />
        </View>
      )}

      {activo && (
        <View style={styles.card}>
          <Segmented label="Visibilidad" options={VIS} value={visibilidad} onChange={setVisibilidad} />
          <Button
            title="Cambiar visibilidad"
            variant="secondary"
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/CambiarVisibilidadElementoPatrimonial',
                  { elementoId, visibilidad },
                  token,
                ),
              )
            }
            loading={busy}
          />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Estado</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" placeholder="Requerido para reactivar/eliminar" />
        {activo ? (
          <>
            <Button
              title="Desactivar elemento"
              variant="danger"
              loading={busy}
              onPress={async () => {
                if (!(await confirmar('Desactivar elemento', 'Deja de contar en tu patrimonio. Se puede reactivar después.', 'Desactivar')))
                  return;
                await run(
                  () =>
                    api.post(
                      '/comandos/DesactivarElementoPatrimonial',
                      { elementoId, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) },
                      token,
                    ),
                  'Elemento desactivado',
                );
              }}
            />
            <Paragraph>
              Eliminar solo si el elemento nunca tuvo movimientos ni valorizaciones.
            </Paragraph>
            <Button
              title="Eliminar elemento"
              variant="danger"
              loading={busy}
              disabled={motivo.trim().length < 3}
              onPress={async () => {
                if (!(await confirmar('Eliminar elemento', 'Borrado definitivo. Solo si nunca tuvo movimientos ni valorizaciones.', 'Eliminar')))
                  return;
                await run(
                  () =>
                    api.post(
                      '/comandos/EliminarElementoPatrimonial',
                      { elementoId, justificacion: motivo.trim() },
                      token,
                    ),
                  'Elemento eliminado',
                );
              }}
            />
          </>
        ) : (
          <Button
            title="Reactivar elemento"
            loading={busy}
            disabled={motivo.trim().length < 3}
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/ReactivarElementoPatrimonial',
                  { elementoId, motivo: motivo.trim() },
                  token,
                ),
              )
            }
          />
        )}
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
