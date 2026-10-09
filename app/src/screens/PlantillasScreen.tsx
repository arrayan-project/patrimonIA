import { useCallback, useState } from 'react';
import { emojiCategoria, emojiTipoMovimiento } from '../emojis';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type PlantillaMovimientoDTO,
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
  Section,
  Skeleton,
  TxRow,
} from '../ui';

/** Catálogos por tipo (plantilla Lista). */
const GRUPOS: [PlantillaMovimientoDTO['tipo'], string][] = [
  ['GASTO', 'Gastos'],
  ['INGRESO', 'Ingresos'],
  ['TRANSFERENCIA', 'Transferencias'],
];

export function PlantillasScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [lista, setLista] = useState<PlantillaMovimientoDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [pls, els, hogares, delHogar] = await Promise.all([
        api.get<PlantillaMovimientoDTO[]>('/usuarios/me/plantillas-movimiento', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
        api.get<HogarDTO[]>('/usuarios/me/hogares', token),
        // D-5: el destino de una transferencia puede ser de otro miembro.
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token).catch(() => []),
      ]);
      setLista(pls);
      setElementos([...els, ...delHogar.filter((e) => !els.some((p) => p.id === e.id))]);
      setCategorias(
        hogares[0]
          ? await api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hogares[0].id}/categorias-movimiento`,
              token,
            )
          : [],
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nueva = () => nav.go('PlantillaForm');
  const nombreEl = (id: string | null) =>
    id ? (elementos.find((e) => e.id === id)?.nombre ?? '—') : null;
  const nombreCat = (id: string | null) =>
    id ? (categorias.find((c) => c.id === id)?.nombre ?? '—') : null;

  const total = lista?.length ?? 0;
  const visibles = filtrar(lista ?? [], (p) => `${p.nombre} ${p.glosa ?? ''}`, busca);

  return (
    <Screen onRefresh={cargar} pie={total > 0 ? <Button title="Nuevo frecuente" onPress={nueva} /> : undefined}>
      <Ayuda>Lo que anotas seguido: elígelo al registrar y queda casi listo.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          emoji="⚡"
          titulo="Aún no tienes frecuentes"
          descripcion="Aparecen arriba al registrar un movimiento."
          accion="Crear la primera"
          onAccion={nueva}
        />
      ) : (
        <>
          <Buscador total={total} value={busca} onChange={setBusca} />
          {GRUPOS.map(([tipo, titulo]) => {
            const filas = visibles.filter((p) => p.tipo === tipo);
            return filas.length ? (
              <Section key={tipo} title={titulo}>
                <ListCard>
                  {filas.map((p) => (
                    <TxRow
                      key={p.id}
                      title={p.nombre}
                      subtitle={
                        [
                          nombreEl(p.elementoOrigenId) && `desde ${nombreEl(p.elementoOrigenId)}`,
                          nombreEl(p.elementoDestinoId) && `a ${nombreEl(p.elementoDestinoId)}`,
                          nombreCat(p.categoriaId),
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Molde en blanco'
                      }
                      amount={p.monto != null ? money(p.monto, p.moneda ?? 'CLP') : ''}
                      logo={{
                        emoji: p.categoriaId
                          ? (emojiCategoria(categorias.find((x) => x.id === p.categoriaId)) ?? emojiTipoMovimiento(p.tipo))
                          : emojiTipoMovimiento(p.tipo),
                      }}
                      onPress={() => nav.go('PlantillaForm', { plantillaId: p.id })}
                    />
                  ))}
                </ListCard>
              </Section>
            ) : null;
          })}
          {visibles.length === 0 && <EmptyState titulo="Nada coincide con la búsqueda" />}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
