import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { GLOSARIO } from '../labels';
import { irAAccion } from './AccionFormScreen';
import type { ReservaParaSacar } from './SacarPlataScreen';
import {
  AccionDestructiva,
  Ayuda,
  Button,
  Dato,
  Datos,
  ErrorText,
  Hero,
  MenuList,
  Migaja,
  Nota,
  Screen,
  Section,
  Skeleton,
} from '../ui';

export function AsignacionDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const asignacionId = nav.route.params?.asignacionId as string;
  const contexto = nav.route.params?.contexto as string | undefined;

  const [asg, setAsg] = useState<AsignacionDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setAsg(await api.get<AsignacionDTO>(`/asignaciones/${asignacionId}`, token));
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

  const nombrePorId = new Map(elementos.map((e) => [e.id, e.nombre]));
  const reservasActivas = (asg.reservas ?? []).filter((r) => r.estado === 'ACTIVA');
  // D-4: un ahorro sin meta ya no recibe plata nueva; solo se saca o se elimina.
  const deUnaMeta = !!asg.objetivoId;
  const paraSacar: ReservaParaSacar[] = reservasActivas.map((r) => ({
    id: r.id,
    cuenta: nombrePorId.get(r.elementoOrigenId) ?? 'Cuenta',
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
            <Button title="Ahorrar" onPress={() => nav.go('Ahorrar', { objetivoId: asg.objetivoId, asignacionId })} />
            {sacar && <Button title="Sacar de la meta" variant="secondary" onPress={sacar} />}
          </>
        ) : sacar ? (
          <Button title="Sacar" onPress={sacar} />
        ) : undefined
      }
    >
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Hero label="Ahorrado" value={money(asg.totalReservado, asg.moneda)} />
      <Ayuda>{GLOSARIO.apartado}</Ayuda>

      <Section title="En qué cuentas está">
        {reservasActivas.length === 0 ? (
          <Nota>Aún no ahorras aquí.</Nota>
        ) : (
          <Datos>
            {paraSacar.map((r) => (
              <Dato key={r.id} etiqueta={r.cuenta} valor={money(r.monto, asg.moneda)} />
            ))}
          </Datos>
        )}
      </Section>

      <MenuList
        items={[
          {
            title: 'Historial de cambios',
            icon: 'time-outline',
            onPress: () =>
              nav.go('Historial', { entidadTipo: 'ASIGNACION', entidadId: asignacionId, contexto: asg.nombre }),
          },
        ]}
      />

      <ErrorText>{error}</ErrorText>
      <AccionDestructiva
        title={deUnaMeta ? 'Eliminar esta parte' : 'Eliminar este ahorro'}
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
