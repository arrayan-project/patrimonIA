import { useCallback, useState, type ReactNode } from 'react';
import { emojiCategoria } from '../emojis';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type CategoriaMovimientoDTO, type HogarDTO } from '../api/client';
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
  Ordenar,
  Screen,
  Section,
  Skeleton,
  TxRow,
} from '../ui';

/** Catálogos por tipo (plantilla Lista): una sección por a qué movimientos aplica. */
const GRUPOS = [
  ['GASTO', 'Gastos'],
  ['INGRESO', 'Ingresos'],
  ['AMBOS', 'Gastos e ingresos'],
] as const;

export function CategoriasScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [hogarId, setHogarId] = useState<string | null>(null);
  const [lista, setLista] = useState<CategoriaMovimientoDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      const h = hogares[0]?.id ?? null;
      setHogarId(h);
      setLista(
        h ? await api.get<CategoriaMovimientoDTO[]>(`/hogares/${h}/categorias-movimiento`, token) : [],
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nueva = () => nav.go('CatalogoForm', { catalogo: 'categoria' });
  const raices = (lista ?? []).filter((x) => !x.categoriaPadreId);
  const hijosDe = (id: string) => (lista ?? []).filter((x) => x.categoriaPadreId === id);

  // Sube o baja una raíz respecto de la vecina de su mismo grupo.
  const mover = (grupo: CategoriaMovimientoDTO[], i: number, delta: number) => {
    const a = grupo[i];
    const b = grupo[i + delta];
    if (!a || !b) return;
    const orden = [...raices];
    const ia = orden.indexOf(a);
    const ib = orden.indexOf(b);
    [orden[ia], orden[ib]] = [orden[ib], orden[ia]];
    // orden espera TODAS las categorías del hogar — raíces reordenadas + sus hijos.
    const ids = orden.flatMap((r) => [r.id, ...hijosDe(r.id).map((h) => h.id)]);
    api
      .post('/comandos/ReordenarCategoriasMovimiento', { hogarId, orden: ids }, token)
      .then(cargar)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  };

  const fila = (cat: CategoriaMovimientoDTO, padre?: CategoriaMovimientoDTO, accesorio?: ReactNode) => {
    const hijos = padre ? 0 : hijosDe(cat.id).length;
    return (
      <TxRow
        key={cat.id}
        title={cat.nombre}
        subtitle={
          padre ? `Dentro de ${padre.nombre}` : hijos ? `${hijos} subcategoría${hijos === 1 ? '' : 's'}` : undefined
        }
        amount=""
        logo={{ emoji: emojiCategoria(cat) ?? '🏷️' }}
        accesorio={accesorio}
        onPress={() => nav.go('CatalogoForm', { catalogo: 'categoria', id: cat.id })}
      />
    );
  };

  const filtrando = busca.trim() !== '';
  const total = lista?.length ?? 0;

  return (
    <Screen onRefresh={cargar} pie={total > 0 ? <Button title="Nueva categoría" onPress={nueva} /> : undefined}>
      <Ayuda>Clasifican ingresos y gastos del hogar.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          emoji="🏷️"
          titulo="Aún no hay categorías"
          descripcion="Sirven para ver en qué se va la plata (Mercado, Servicios, Sueldo…)."
          accion="Crear la primera"
          onAccion={nueva}
        />
      ) : (
        <>
          <Buscador total={total} value={busca} onChange={setBusca} />
          {GRUPOS.map(([tipo, titulo]) => {
            const grupo = raices.filter((r) => r.tipoAplicable === tipo);
            const filas = grupo.flatMap((r, i) => {
              const hijos = hijosDe(r.id);
              if (!filtrando)
                return [
                  fila(r, undefined, (
                    <Ordenar
                      onSubir={i > 0 ? () => mover(grupo, i, -1) : undefined}
                      onBajar={i < grupo.length - 1 ? () => mover(grupo, i, 1) : undefined}
                    />
                  )),
                  ...hijos.map((h) => fila(h, r)),
                ];
              return [
                ...filtrar([r], (x) => x.nombre, busca).map((x) => fila(x)),
                ...filtrar(hijos, (x) => x.nombre, busca).map((h) => fila(h, r)),
              ];
            });
            return filas.length ? (
              <Section key={tipo} title={titulo}>
                <ListCard>{filas}</ListCard>
              </Section>
            ) : null;
          })}
          {filtrando && filtrar(lista, (x) => x.nombre, busca).length === 0 && (
            <EmptyState titulo="Nada coincide con la búsqueda" />
          )}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
