import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type ObjetivoFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { emojiElemento, emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { irAAccion } from './AccionFormScreen';
import type { ReservaParaSacar } from './SacarPlataScreen';
import {
  BandaDetalle,
  Button,
  ErrorText,
  ListCard,
  MenuList,
  Nota,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
} from '../ui';

export function AsignacionDetalleScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const asignacionId = nav.route.params?.asignacionId as string;

  const [asg, setAsg] = useState<AsignacionDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [meta, setMeta] = useState<ObjetivoFinancieroDTO | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const a = await api.get<AsignacionDTO>(`/asignaciones/${asignacionId}`, token);
      setAsg(a);
      // G35: la banda dice de qué meta es (antes, una miga con el contexto).
      setMeta(
        a.objetivoId
          ? await api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${a.objetivoId}`, token).catch(() => null)
          : null,
      );
      setElementos(
        await api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [asignacionId, token]);

  useCargaAlEnfocar(cargar);

  useTitulo(asg?.nombre);

  if (!asg) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const porId = new Map(elementos.map((e) => [e.id, e]));
  const reservasActivas = (asg.reservas ?? []).filter((r) => r.estado === 'ACTIVA');
  // D-4: un ahorro sin meta ya no recibe plata nueva; solo se saca o se elimina.
  const deUnaMeta = !!asg.objetivoId;
  const paraSacar: ReservaParaSacar[] = reservasActivas.map((r) => ({
    id: r.id,
    cuenta: porId.get(r.elementoOrigenId)?.nombre ?? 'Cuenta',
    monto: r.monto,
  }));
  const sacar =
    paraSacar.length > 0
      ? () => nav.go('SacarPlata', { reservas: paraSacar, moneda: asg.moneda, deUnaMeta })
      : undefined;

  return (
    <Screen
      onRefresh={cargar}
      pie={
        deUnaMeta ? (
          <>
            <Button title="🐷 Ahorrar" onPress={() => nav.go('Ahorrar', { objetivoId: asg.objetivoId, asignacionId })} />
            {sacar && <Button title="💸 Sacar de la meta" variant="secondary" onPress={sacar} />}
          </>
        ) : sacar ? (
          <Button title="💸 Sacar" onPress={sacar} />
        ) : undefined
      }
    >
      <BandaDetalle
        color={c.primary}
        titulo="🐷 Ahorrado"
        monto={money(asg.totalReservado, asg.moneda)}
        sub={
          deUnaMeta
            ? `${meta ? emojiMeta(meta.id, preferencias.emojis.metas) : '🎯'} Para ${meta?.nombre ?? 'una meta'}`
            : 'Sin meta'
        }
      />

      <Section title="🏦 En qué cuentas está">
        {reservasActivas.length === 0 ? (
          <Nota>Aún no ahorras aquí.</Nota>
        ) : (
          <ListCard>
            {reservasActivas.map((r) => {
              const el = porId.get(r.elementoOrigenId);
              return (
                <TxRow
                  key={r.id}
                  title={el?.nombre ?? 'Cuenta'}
                  amount={money(r.monto, asg.moneda)}
                  logo={{ emoji: el ? emojiElemento(el, preferencias.emojis.elementos) : '🏦' }}
                  onPress={el ? () => nav.go('ElementoDetalle', { elementoId: el.id }) : undefined}
                />
              );
            })}
          </ListCard>
        )}
      </Section>

      <MenuList
        items={[
          {
            title: 'Historial de cambios',
            emoji: '🕓',
            onPress: () =>
              nav.go('Historial', { entidadTipo: 'ASIGNACION', entidadId: asignacionId, contexto: asg.nombre }),
          },
        ]}
      />

      <ErrorText>{error}</ErrorText>
      <Button
        title={deUnaMeta ? '🗑️ Eliminar esta parte' : '🗑️ Eliminar este ahorro'}
        variant="danger"
        onPress={() =>
          irAAccion(nav, {
            titulo: deUnaMeta ? 'Eliminar esta parte' : 'Eliminar este ahorro',
            explicacion: 'Toda la plata ahorrada aquí vuelve a quedar libre para gastar. No sale de tus cuentas.',
            pregunta: '¿Por qué lo eliminas?',
            boton: deUnaMeta ? 'Eliminar esta parte' : 'Eliminar este ahorro',
            comando: 'EliminarAsignacion',
            body: { asignacionId },
            aviso: 'Ahorro eliminado',
            peligro: true,
            volver: 2,
          })
        }
      />
    </Screen>
  );
}
