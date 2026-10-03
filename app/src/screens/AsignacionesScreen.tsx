import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type AsignacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Ayuda, EmptyState, ErrorText, ListCard, Screen, Skeleton, TxRow } from '../ui';

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
      <Ayuda>Plata separada sin meta; no está libre.</Ayuda>

      {sueltas.length > 0 ? (
        <ListCard>
          {sueltas.map((a) => (
            <TxRow
              key={a.id}
              title={a.nombre}
              amount={money(a.totalReservado, 'CLP')}
              logo={{ icon: 'wallet-outline' }}
              onPress={() => nav.go('AsignacionDetalle', { asignacionId: a.id })}
            />
          ))}
        </ListCard>
      ) : (
        <EmptyState
          icon="wallet-outline"
          titulo="No tienes ahorro sin meta"
          descripcion="Para ahorrar algo nuevo, crea una meta."
          accion="Crear una meta"
          onAccion={() => nav.go('NuevaMeta')}
        />
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
