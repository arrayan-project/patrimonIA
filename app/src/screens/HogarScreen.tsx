import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type ObjetivoFinancieroDTO,
  type PatrimonioConsolidadoDTO,
} from '../api/client';
import { Pressable } from 'react-native';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { leer } from '../auth/secureStorage';
import { money } from '../format';
import { emojiElemento } from '../emojis';
import { usePreferencias } from '../preferencias';
import { cargarCuentasHogar, deQuien } from '../cuentasHogar';
import { cargarEntreMiembros, type EntreMiembros } from '../entreMiembros';
import { FilaEntreRow } from './EntreMiembrosScreen';
import { TarjetaMeta } from './ObjetivosScreen';
import { invitarAlHogar } from './GestionHogarScreen';
import {
  ErrorText,
  Hero,
  IconButton,
  ListCard,
  MenuList,
  Nota,
  Screen,
  Section,
  Skeleton,
  Title,
  TopRow,
  TxRow,
} from '../ui';

/** Tab "Hogar": la plata que comparten, lo que pasa entre ustedes y las personas del hogar. */
export function HogarScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [suman, setSuman] = useState<ElementoPatrimonialDTO[]>([]);
  // HZ-10 (3) / D-2: cuentas de otros miembros visibles que no suman ("Que
  // puedan transferirte"). Sin esto parecía que ese nivel no hacía nada.
  const [paraTransferir, setParaTransferir] = useState<ElementoPatrimonialDTO[]>([]);
  const [metas, setMetas] = useState<ObjetivoFinancieroDTO[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [invitaciones, setInvitaciones] = useState(0);
  const [cons, setCons] = useState<PatrimonioConsolidadoDTO | null>(null);
  // HZ-21: "Entre [miembro] y tú".
  const [entre, setEntre] = useState<EntreMiembros | null>(null);
  // G39 (H1, H4): cuántas de tus cuentas suman a la plata del hogar.
  const [mias, setMias] = useState<ElementoPatrimonialDTO[] | null>(null);
  // G39 (H6): cuántas personas más hay en el hogar.
  const [otros, setOtros] = useState<number | null>(null);
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
      setCons(await api.get<PatrimonioConsolidadoDTO>(`/hogares/${h.id}/patrimonio-consolidado`, token).catch(() => null));

      try {
        const [cuentas, objs] = await Promise.all([
          cargarCuentasHogar(token),
          api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
        ]);
        setSuman(cuentas.suman);
        setParaTransferir(cuentas.paraTransferir);
        setMetas(objs.filter((o) => o.hogarId === h.id && o.estado !== 'CANCELADO'));
      } catch {
        setSuman([]);
        setParaTransferir([]);
        setMetas([]);
      }

      setEntre(await cargarEntreMiembros(token, usuario.id, h.id).catch(() => null));
      api
        .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
        .then((xs) => setMias(xs.filter((e) => e.estado === 'ACTIVO' && e.naturaleza !== 'CUSTODIA_INFORMAL')))
        .catch(() => setMias(null));
      api
        .get<HogarDTO>(`/hogares/${h.id}`, token)
        .then((d) => setOtros((d.miembros ?? []).filter((m) => m.usuarioId !== usuario.id).length))
        .catch(() => setOtros(null));
      api
        .get<{ noLeidas: number }>('/usuarios/me/notificaciones/no-leidas', token)
        .then(({ noLeidas: n }) => setNoLeidas(n))
        .catch(() => setNoLeidas(0));
      api
        .get<unknown[]>('/usuarios/me/invitaciones?estado=PENDIENTE', token)
        .then((xs) => setInvitaciones(xs.length))
        .catch(() => setInvitaciones(0));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, usuario.id, claveHogar, nav]);

  useCargaAlEnfocar(cargar);

  if (!hogar) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const verPatrimonio = () => nav.go('HogarConsolidado', { hogarId: hogar.id });
  const pm = cons?.porMoneda[0];
  // Tienen − Deben = total: solo si cuadra (una moneda, la del hogar).
  const cuadra =
    cons && pm && cons.porMoneda.length === 1 && pm.moneda === cons.monedaConsolidacion &&
    Math.abs(pm.activos - Math.abs(pm.pasivos) - pm.patrimonioNeto) < 1;

  return (
    <Screen onRefresh={cargar}>
      <TopRow
        left={<Title>{hogar.nombre}</Title>}
        right={
          <>
            <IconButton
              icon="notifications-outline"
              badge={noLeidas || undefined}
              accessibilityLabel="Notificaciones"
              onPress={() => nav.go('Notificaciones')}
            />
            <IconButton icon="settings-outline" accessibilityLabel="Ajustes" onPress={() => nav.go('Ajustes')} />
          </>
        }
      />

      <Pressable onPress={verPatrimonio} accessibilityRole="button" accessibilityLabel="Ver la plata del hogar">
        <Hero
          label="🏠 Plata del hogar"
          value={cons?.total != null ? money(cons.total, cons.monedaConsolidacion) : '—'}
          substats={
            cuadra && pm
              ? [
                  { label: '💰 Tienen', value: money(pm.activos, pm.moneda) },
                  { label: '💳 Deben', value: money(Math.abs(pm.pasivos), pm.moneda) },
                ]
              : undefined
          }
        />
      </Pressable>

      {/* G39 (H6): solo en el hogar, invitar va arriba; con más personas, en "Más del hogar". */}
      {otros === 0 && (
        <MenuList
          items={[
            {
              title: 'Invita a quien vive contigo',
              subtitle: 'Le llega un correo para unirse a tu hogar',
              emoji: '👥',
              onPress: () => invitarAlHogar(nav, hogar.id),
            },
          ]}
        />
      )}
      {/* G39 (H1): la plata del hogar es lo que suma; de un vistazo, cuánto de lo tuyo. */}
      {mias && mias.length > 0 && (
        <MenuList
          items={[
            {
              title: `De lo tuyo suman ${mias.filter((e) => e.participaConsolidacion).length} de ${mias.length}`,
              subtitle: 'Revisa qué compartes',
              emoji: '🔐',
              onPress: () => nav.go('QueCompartes'),
            },
          ]}
        />
      )}

      {entre && entre.otros.length > 0 && (
        <Section
          title={`🤝 ${entre.titulo}`}
          accion={`Ver todo (${entre.filas.length})`}
          onAccion={entre.filas.length > 4 ? () => nav.go('EntreMiembros', { hogarId: hogar.id }) : undefined}
        >
          {entre.filas.length === 0 ? (
            <Nota>Todavía nada: aquí aparece lo que se piden y lo que se transfieren.</Nota>
          ) : (
            <ListCard>
              {entre.filas.slice(0, 4).map((f) => (
                <FilaEntreRow key={f.key} f={f} />
              ))}
            </ListCard>
          )}
        </Section>
      )}

      <Section
        title="🏠 Lo que suma al hogar"
        accion={`Ver todo (${suman.length})`}
        onAccion={suman.length > 4 ? verPatrimonio : undefined}
      >
        {suman.length === 0 ? (
          <Nota>Ninguna cuenta ni bien suma al hogar por ahora.</Nota>
        ) : (
          <ListCard>
            {suman.slice(0, 4).map((e) => (
              <TxRow
                key={e.id}
                title={e.nombre}
                subtitle={deQuien(e, usuario.id)}
                amount={e.valorOculto ? '—' : money(e.valorVigente, e.moneda)}
                negativo={!e.valorOculto && e.valorVigente < 0}
                logo={{ emoji: emojiElemento(e, preferencias.emojis.elementos) }}
                onPress={() => nav.go('ElementoDetalle', { elementoId: e.id })}
              />
            ))}
          </ListCard>
        )}
      </Section>

      {paraTransferir.length > 0 && (
        <Section title="🔁 Para transferirles">
          <ListCard>
            {paraTransferir.map((e) => (
              <TxRow
                key={e.id}
                title={e.nombre}
                subtitle={deQuien(e, usuario.id)}
                amount={e.valorOculto ? '' : money(e.valorVigente, e.moneda)}
                logo={{ emoji: emojiElemento(e, preferencias.emojis.elementos) }}
                onPress={() => nav.go('RegistrarMovimiento', { tipo: 'TRANSFERENCIA', destinoId: e.id })}
              />
            ))}
          </ListCard>
        </Section>
      )}

      <Section
        title="🎯 Metas del hogar"
        accion={`Ver todas (${metas.length})`}
        onAccion={metas.length > 4 ? () => nav.go('Objetivos') : undefined}
      >
        {metas.length === 0 ? (
          <Nota>Ninguna meta compartida con el hogar.</Nota>
        ) : (
          metas.slice(0, 4).map((o) => <TarjetaMeta key={o.id} o={o} ahorrar />)
        )}
      </Section>

      <Section title="Más del hogar">
        <MenuList
          items={[
            {
              title: 'Personas del hogar',
              subtitle: 'Nombre y quiénes están',
              emoji: '👥',
              onPress: () => nav.go('GestionHogar', { hogarId: hogar.id }),
            },
            {
              title: 'Movimientos del hogar',
              subtitle: 'Lo que entra, sale y se mueve en el hogar',
              emoji: '🧾',
              onPress: () => nav.go('MovimientosHogar', { hogarId: hogar.id }),
            },
            {
              title: 'Qué compartes',
              subtitle: 'Qué ve el hogar de cada cuenta tuya y qué suma',
              emoji: '🔐',
              onPress: () => nav.go('QueCompartes'),
            },
            ...(otros
              ? [
                  {
                    title: 'Invitar a alguien',
                    subtitle: 'Le llega un correo para unirse',
                    emoji: '➕',
                    onPress: () => invitarAlHogar(nav, hogar.id),
                  },
                ]
              : []),
            ...(invitaciones > 0
              ? [
                  {
                    title: 'Te invitaron a otro hogar',
                    subtitle: invitaciones === 1 ? '1 invitación por responder' : `${invitaciones} invitaciones por responder`,
                    emoji: '📩',
                    badge: invitaciones,
                    onPress: () => nav.go('Invitaciones'),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
