import { useCallback, useState } from 'react';
import { emojiMoneda } from '../emojis';
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
          ? `Cuánto vale el dólar o la UF en pesos. USD, EUR y UF se actualizan solos cada hora (${fechaLegible(ultimaImportada.fechaVigencia)}).`
          : 'Cuánto vale el dólar o la UF en pesos. USD, EUR y UF se actualizan solos cada hora.'}
      </Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          emoji="💵"
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
                  // G35: "1 USD = 960 CLP" se entiende solo.
                  title={`1 ${t.monedaOrigen} = ${t.tasa.toLocaleString('es-CL', { maximumFractionDigits: 4 })} ${t.monedaDestino}`}
                  subtitle={`${fechaLegible(t.fechaVigencia)} · ${t.fuente ? 'se actualiza sola' : 'anotada por ti'}`}
                  amount=""
                  logo={{ emoji: emojiMoneda(t.monedaOrigen) }}
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
