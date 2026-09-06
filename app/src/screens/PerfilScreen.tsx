import { useMemo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type UsuarioDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import { Ayuda, Button, ErrorText, Field, Paragraph, Row, Screen, Segmented, Title, Panel, useC, tipoDe, type Paleta } from '../ui';

const NOTIF_TIPOS = [
  ['OBJETIVO_COMPLETADO', 'Objetivo completado'],
  ['RESERVA_CONSUMIDA', 'Reservas consumidas'],
  ['INVITACION_RECIBIDA', 'Invitación a un hogar'],
] as const;

export function PerfilScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const { cerrarSesion } = useAuth();
  const toast = useToast();
  const nav = useNav();

  const [me, setMe] = useState<UsuarioDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [notif, setNotif] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intento, setIntento] = useState(false);
  const notifDe = (u: UsuarioDTO): Record<string, boolean> =>
    ((u.preferencias as { notificaciones?: Record<string, boolean> } | null)?.notificaciones) ?? {};
  const notifSucio =
    !!me && NOTIF_TIPOS.some(([k]) => (notif[k] !== false) !== (notifDe(me)[k] !== false));
  const sucio =
    (!!me && nombre.trim() !== me.nombre) || motivo.trim().length > 0 || notifSucio;
  const permitirSalida = useConfirmarDescarte(sucio && !busy);
  const errNombre = nombre.trim() ? '' : 'El nombre no puede quedar vacío.';

  useEffect(() => {
    api
      .get<UsuarioDTO>('/usuarios/me', token)
      .then((u) => {
        setMe(u);
        setNombre(u.nombre);
        setNotif(notifDe(u));
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  const guardar = async () => {
    setIntento(true);
    if (errNombre) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/comandos/ActualizarDatosUsuario', { nombre: nombre.trim() }, token);
      toast.mostrar('Perfil actualizado');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const guardarNotif = async () => {
    setBusy(true);
    setError('');
    try {
      const base = (me?.preferencias as Record<string, unknown> | null) ?? {};
      await api.post(
        '/comandos/ActualizarDatosUsuario',
        { preferencias: { ...base, notificaciones: notif } },
        token,
      );
      const u = await api.get<UsuarioDTO>('/usuarios/me', token);
      setMe(u);
      setNotif(notifDe(u));
      toast.mostrar('Preferencias guardadas');
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
      permitirSalida();
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
        <Panel>
          <Row left="Email" right={me.email} />
          <Field
            label="Nombre"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="sentences"
            error={intento ? errNombre : undefined}
          />
          <Button title="Guardar" onPress={guardar} loading={busy} />
        </Panel>
      )}

      {me && (
        <Panel>
          <Text style={styles.sectionTitle}>Notificaciones</Text>
          <Ayuda>Elige qué avisos quieres recibir (en la app y como push).</Ayuda>
          {NOTIF_TIPOS.map(([k, etiq]) => (
            <Segmented
              key={k}
              label={etiq}
              options={['Sí', 'No'] as const}
              value={notif[k] === false ? 'No' : 'Sí'}
              onChange={(v) => setNotif((n) => ({ ...n, [k]: v === 'Sí' }))}
              formatearOpcion={(v) => v}
            />
          ))}
          <Button
            title="Guardar preferencias"
            variant="secondary"
            onPress={guardarNotif}
            loading={busy}
            disabled={!notifSucio}
          />
        </Panel>
      )}

      <Panel>
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
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
});
