import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type ObjetivoFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { leer } from '../auth/secureStorage';
import { money } from '../format';
import {
  ErrorText,
  GroupLabel,
  IconButton,
  ListItem,
  MenuList,
  Nota,
  Panel,
  Screen,
  Skeleton,
  Title,
  TopRow,
} from '../ui';

/** Tab "Hogar": personas y lo que se comparte. El patrimonio consolidado vive en Inicio (toggle). */
export function HogarScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [compartidos, setCompartidos] = useState<ElementoPatrimonialDTO[]>([]);
  const [objetivosHogar, setObjetivosHogar] = useState<ObjetivoFinancieroDTO[]>([]);
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
      const h = lista.find((x) => x.id === guardado) ?? lista[0];
      setHogar(h);

      try {
        const [els, objs] = await Promise.all([
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token),
          api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
        ]);
        setCompartidos(els.filter((e) => e.participaConsolidacion));
        setObjetivosHogar(objs.filter((o) => o.hogarId));
      } catch {
        setCompartidos([]);
        setObjetivosHogar([]);
      }

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

  if (!hogar) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <TopRow
        left={<Title>{hogar.nombre}</Title>}
        right={
          <IconButton
            icon="notifications-outline"
            badge={noLeidas || undefined}
            accessibilityLabel="Notificaciones"
            onPress={() => nav.go('Notificaciones')}
          />
        }
      />

      <GroupLabel>Personas</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Miembros y roles',
            subtitle: 'Nombre del hogar, miembros, roles, moneda de consolidación',
            icon: 'people-outline',
            onPress: () => nav.go('GestionHogar', { hogarId: hogar.id }),
          },
          {
            title: 'Invitaciones recibidas',
            subtitle: 'Hogares a los que te invitaron',
            icon: 'mail-outline',
            onPress: () => nav.go('Invitaciones'),
          },
        ]}
      />

      <GroupLabel>Qué se comparte</GroupLabel>
      <Panel gap={0}>
        <ListItem
          title="Elementos en el patrimonio del hogar"
          subtitle={
            compartidos.length === 0
              ? 'Ninguno por ahora'
              : `${compartidos.length} ${compartidos.length === 1 ? 'elemento cuenta' : 'elementos cuentan'} en la consolidación`
          }
        />
        {compartidos.slice(0, 4).map((e) => (
          <ListItem
            key={e.id}
            title={e.nombre}
            subtitle={e.propietarios.map((p) => p.nombre ?? 'Propietario').join(', ')}
            right={e.valorOculto ? '—' : money(e.valorVigente, e.moneda)}
            onPress={() => nav.go('ElementoDetalle', { elementoId: e.id })}
          />
        ))}
        {compartidos.length > 4 && <Nota>y {compartidos.length - 4} más</Nota>}
      </Panel>
      <Panel gap={0}>
        <ListItem
          title="Objetivos del hogar"
          subtitle={
            objetivosHogar.length === 0
              ? 'Ninguno compartido'
              : `${objetivosHogar.length} ${objetivosHogar.length === 1 ? 'objetivo compartido' : 'objetivos compartidos'}`
          }
        />
        {objetivosHogar.slice(0, 4).map((o) => (
          <ListItem
            key={o.id}
            title={o.nombre}
            subtitle={`${o.progresoPorcentaje}% · ${money(o.progreso, o.moneda)} de ${money(o.montoObjetivo, o.moneda)}`}
            onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
          />
        ))}
      </Panel>

      <GroupLabel>Patrimonio</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Patrimonio del hogar',
            subtitle: 'Consolidado por moneda, distribución de activos y pasivos',
            icon: 'home-outline',
            onPress: () => nav.go('HogarConsolidado', { hogarId: hogar.id }),
          },
          {
            title: 'Movimientos del hogar',
            subtitle: 'Ingresos, gastos y transferencias sobre el patrimonio consolidado',
            icon: 'swap-horizontal-outline',
            onPress: () => nav.go('MovimientosHogar', { hogarId: hogar.id }),
          },
        ]}
      />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
