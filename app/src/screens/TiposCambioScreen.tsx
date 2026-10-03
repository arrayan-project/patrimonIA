import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type TipoCambioDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import {
  Ayuda,
  Buscador,
  Button,
  EmptyState,
  ErrorText,
  fechaLegible,
  filtrar,
  ListCard,
  Screen,
  Skeleton,
  TxRow,
} from '../ui';

export function TiposCambioScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [lista, setLista] = useState<TipoCambioDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<TipoCambioDTO[]>('/tipos-cambio', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nueva = () => nav.go('CatalogoForm', { catalogo: 'tipoCambio' });
  const total = lista?.length ?? 0;
  const visibles = filtrar(lista ?? [], (t) => `${t.monedaOrigen} ${t.monedaDestino}`, busca);

  // G32 H-14 — USD, EUR y UF se importan solos (G21); se dice de dónde y cuándo.
  const ultimaImportada = (lista ?? [])
    .filter((t) => t.fuente)
    .reduce<TipoCambioDTO | null>((max, t) => (!max || t.createdAt > max.createdAt ? t : max), null);

  return (
    <Screen onRefresh={cargar} pie={total > 0 ? <Button title="Registrar tasa" onPress={nueva} /> : undefined}>
      <Ayuda>
        {ultimaImportada
          ? `USD, EUR y UF se actualizan solos cada hora (${ultimaImportada.fuente}, ${fechaLegible(ultimaImportada.fechaVigencia)}).`
          : 'USD, EUR y UF se actualizan solos cada hora.'}
      </Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          icon="swap-horizontal-outline"
          titulo="Aún no hay tasas"
          descripcion="Registra una a mano solo para otra moneda o una tasa distinta."
          accion="Registrar la primera"
          onAccion={nueva}
        />
      ) : (
        <>
          <Buscador total={total} value={busca} onChange={setBusca} />
          {visibles.length === 0 ? (
            <EmptyState titulo="Nada coincide con la búsqueda" />
          ) : (
            <ListCard>
              {visibles.map((t) => (
                <TxRow
                  key={t.id}
                  title={`${t.monedaOrigen} → ${t.monedaDestino}`}
                  subtitle={`${fechaLegible(t.fechaVigencia)} · ${t.fuente ?? 'a mano'}`}
                  amount={String(t.tasa)}
                  logo={{ icon: 'swap-horizontal-outline' }}
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
