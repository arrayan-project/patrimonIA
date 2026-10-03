import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type AsignacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Ayuda, ErrorText, ListItem, Nota, Panel, Screen, Title, Skeleton } from '../ui';

/**
 * A7 — "Ahorro sin meta" (D-4 de G33): solo muestra las asignaciones sueltas que
 * ya existen. Ya no se crean nuevas: para ahorrar se crea una meta. Las
 * asignaciones de una meta se ven dentro de la meta.
 */
export function AsignacionesScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setAsignaciones(await api.get<AsignacionDTO[]>('/asignaciones', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  if (!asignaciones) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const sueltas = asignaciones.filter((a) => !a.objetivoId);

  return (
    <Screen onRefresh={cargar}>
      <Title>Ahorro sin meta</Title>
      <Ayuda>
        Plata que separaste antes sin asociarla a una meta. Sigue en tus cuentas y
        no cuenta como libre para gastar. Para ahorrar algo nuevo, crea una meta.
      </Ayuda>

      {sueltas.length > 0 ? (
        <Panel gap={0}>
          {sueltas.map((a) => (
            <ListItem
              key={a.id}
              title={a.nombre}
              right={money(a.totalReservado, 'CLP')}
              onPress={() => nav.go('AsignacionDetalle', { asignacionId: a.id })}
            />
          ))}
        </Panel>
      ) : (
        <Panel>
          <Nota>No tienes ahorro sin meta.</Nota>
        </Panel>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
