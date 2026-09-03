import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { leer } from '../auth/secureStorage';
import { ErrorText, GroupLabel, MenuLink, Screen, Title } from '../ui';

/** Tab "Hogar": patrimonio consolidado, gestión de miembros y notificaciones. */
export function HogarScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      if (lista.length === 0) {
        nav.reset('Bienvenida');
        return;
      }
      const guardado = await leer(claveHogar);
      setHogar(lista.find((h) => h.id === guardado) ?? lista[0]);
      try {
        const { noLeidas: n } = await api.get<{ noLeidas: number }>(
          '/usuarios/me/notificaciones/no-leidas',
          token,
        );
        setNoLeidas(n);
      } catch {
        setNoLeidas(0);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, claveHogar, nav]);

  useCargaAlEnfocar(cargar);

  return (
    <Screen onRefresh={cargar}>
      <Title>{hogar?.nombre ?? 'Hogar'}</Title>

      <MenuLink
        title="Notificaciones"
        subtitle={noLeidas > 0 ? `${noLeidas} sin leer` : 'Al día'}
        badge={noLeidas || undefined}
        onPress={() => nav.go('Notificaciones')}
      />

      <GroupLabel>Patrimonio</GroupLabel>
      <MenuLink
        title="Patrimonio del hogar"
        subtitle="Vista consolidada de todos los miembros"
        onPress={() => hogar && nav.go('HogarConsolidado', { hogarId: hogar.id })}
      />

      <GroupLabel>Administración</GroupLabel>
      <MenuLink
        title="Gestionar hogar"
        subtitle="Nombre, miembros, roles e invitaciones"
        onPress={() => hogar && nav.go('GestionHogar', { hogarId: hogar.id })}
      />
      <MenuLink
        title="Invitaciones recibidas"
        subtitle="Hogares a los que te invitaron"
        onPress={() => nav.go('Invitaciones')}
      />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
