import { useEffect, useState } from 'react';
import { api, ApiError, type UsuarioDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Ayuda, Button, ErrorText, Screen, Segmented, Skeleton, Title } from '../ui';

const NOTIF_TIPOS = [
  ['OBJETIVO_COMPLETADO', 'Objetivo completado'],
  ['RESERVA_CONSUMIDA', 'Reservas consumidas'],
  ['INVITACION_RECIBIDA', 'Invitación a un hogar'],
] as const;

function notifDe(u: UsuarioDTO): Record<string, boolean> {
  return (
    ((u.preferencias as { notificaciones?: Record<string, boolean> } | null)?.notificaciones) ?? {}
  );
}

/** Preferencias de qué avisos recibir (en la app y como push). Vive en Ajustes › Cuenta. */
export function AjustesNotificacionesScreen() {
  const { token } = useSession();
  const toast = useToast();
  const nav = useNav();

  const [me, setMe] = useState<UsuarioDTO | null>(null);
  const [notif, setNotif] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<UsuarioDTO>('/usuarios/me', token)
      .then((u) => {
        setMe(u);
        setNotif(notifDe(u));
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  const sucio = !!me && NOTIF_TIPOS.some(([k]) => (notif[k] !== false) !== (notifDe(me)[k] !== false));

  const guardar = async () => {
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
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!me) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton filas={2} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Notificaciones</Title>
      <Ayuda>Elige qué avisos quieres recibir, en la app y como push.</Ayuda>
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
      <ErrorText>{error}</ErrorText>
      <Button title="Guardar preferencias" onPress={guardar} loading={busy} disabled={!sucio} />
    </Screen>
  );
}
