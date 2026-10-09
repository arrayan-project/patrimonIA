import { useCallback, useState } from 'react';

import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AgrupacionDTO,
  type ElementoPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
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

export function AgrupacionesScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [lista, setLista] = useState<AgrupacionDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [ags, els] = await Promise.all([
        api.get<AgrupacionDTO[]>('/usuarios/me/agrupaciones', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      setLista(ags);
      setElementos(els);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nueva = () => nav.go('CatalogoForm', { catalogo: 'agrupacion' });
  const total = lista?.length ?? 0;
  const visibles = filtrar(lista ?? [], (a) => a.nombre, busca);

  // Contexto de la fila: qué hay dentro y, si es una sola moneda, cuánto suma.
  const contexto = (a: AgrupacionDTO) => {
    const els = elementos.filter((e) => a.elementoIds.includes(e.id));
    const n = els.length;
    const texto = n === 0 ? 'Vacío' : els.map((e) => e.nombre).join(', ');
    const monedas = new Set(els.map((e) => e.moneda));
    const suma = monedas.size === 1 ? money(els.reduce((s, e) => s + e.valorVigente, 0), [...monedas][0]) : '';
    return { texto, suma };
  };

  return (
    <Screen onRefresh={cargar} pie={total > 0 ? <Button title="🗂️ Nuevo grupo" onPress={nueva} /> : undefined}>
      <Ayuda>Ordenan tus cuentas en Tu plata; no cambian tus totales.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          emoji="🗂️"
          titulo="Aún no tienes grupos"
          descripcion="Junta cuentas como “Jubilación” (APV + fondo) o “Viaje”, y verlas juntas en Tu plata."
          accion="🗂️ Crear el primero"
          onAccion={nueva}
        />
      ) : (
        <>
          <Buscador total={total} value={busca} onChange={setBusca} />
          {visibles.length === 0 ? (
            <EmptyState titulo="Nada coincide con la búsqueda" />
          ) : (
            <ListCard>
              {visibles.map((a) => {
                const { texto, suma } = contexto(a);
                return (
                  <TxRow
                    key={a.id}
                    title={a.nombre}
                    subtitle={texto}
                    amount={suma}
                    logo={{ emoji: '🗂️', color: a.color ?? undefined }}
                    onPress={() => nav.go('CatalogoForm', { catalogo: 'agrupacion', id: a.id })}
                  />
                );
              })}
            </ListCard>
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
