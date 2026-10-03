import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type EtiquetaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import {
  Ayuda,
  Buscador,
  Button,
  EmptyState,
  ErrorText,
  filtrar,
  ListCard,
  Screen,
  Skeleton,
  TxRow,
} from '../ui';

export function EtiquetasScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [lista, setLista] = useState<EtiquetaDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nueva = () => nav.go('CatalogoForm', { catalogo: 'etiqueta' });
  const total = lista?.length ?? 0;
  const visibles = filtrar(lista ?? [], (e) => e.nombre, busca);

  return (
    <Screen onRefresh={cargar} pie={total > 0 ? <Button title="Nueva etiqueta" onPress={nueva} /> : undefined}>
      <Ayuda>Marcas tuyas; no entran en el presupuesto.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          titulo="Aún no tienes etiquetas"
          descripcion="Marca movimientos como #reembolsable o #viaje-2026."
          accion="Crear la primera"
          onAccion={nueva}
        />
      ) : (
        <>
          <Buscador total={total} value={busca} onChange={setBusca} />
          {visibles.length === 0 ? (
            <EmptyState titulo="Nada coincide con la búsqueda" />
          ) : (
            <ListCard>
              {visibles.map((e) => (
                <TxRow
                  key={e.id}
                  title={e.nombre}
                  amount=""
                  logo={{ icon: 'pricetag-outline', color: e.color ?? undefined }}
                  onPress={() => nav.go('CatalogoForm', { catalogo: 'etiqueta', id: e.id })}
                />
              ))}
            </ListCard>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
