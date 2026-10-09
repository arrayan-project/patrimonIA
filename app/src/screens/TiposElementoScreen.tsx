import { useCallback, useState } from 'react';
import { EMOJI_CATEGORIA_FUNCIONAL, emojiTipoElemento, NOMBRE_CATEGORIA_FUNCIONAL } from '../emojis';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type TipoElementoDTO } from '../api/client';
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
  ModoOrden,
  Ordenar,
  Screen,
  Section,
  Skeleton,
  TxRow,
} from '../ui';

/** Catálogos por tipo (plantilla Lista): una sección por categoría sugerida, en este orden. */
const GRUPOS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO', null] as const;

export function TiposElementoScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [hogarId, setHogarId] = useState<string | null>(null);
  const [lista, setLista] = useState<TipoElementoDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  // G35: las flechas para ordenar solo aparecen con "Cambiar orden".
  const [ordenando, setOrdenando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      const h = hogares[0]?.id ?? null;
      setHogarId(h);
      setLista(h ? await api.get<TipoElementoDTO[]>(`/hogares/${h}/tipos-elemento`, token) : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nuevo = () => nav.go('CatalogoForm', { catalogo: 'tipoElemento' });

  // Sube o baja un tipo respecto del vecino de su mismo grupo.
  const mover = (grupo: TipoElementoDTO[], i: number, delta: number) => {
    const a = grupo[i];
    const b = grupo[i + delta];
    if (!lista || !a || !b) return;
    const orden = lista.map((t) => t.id);
    const ia = orden.indexOf(a.id);
    const ib = orden.indexOf(b.id);
    [orden[ia], orden[ib]] = [orden[ib], orden[ia]];
    api
      .post('/comandos/ReordenarTiposElemento', { hogarId, orden }, token)
      .then(cargar)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  };

  const filtrando = busca.trim() !== '';
  const total = lista?.length ?? 0;
  const visibles = filtrar(lista ?? [], (t) => t.nombre, busca);

  return (
    <Screen onRefresh={cargar} pie={total > 0 ? <Button title="Nuevo tipo" onPress={nuevo} /> : undefined}>
      <Ayuda>Corriente, tarjeta, fondo mutuo… cada uno dice qué tipo de plata es.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState
          emoji="💼"
          titulo="Aún no hay tipos"
          descripcion="Nombran tus cuentas y bienes: cuenta corriente, APV, propiedad…"
          accion="Crear el primero"
          onAccion={nuevo}
        />
      ) : (
        <>
          {!ordenando && <Buscador total={total} value={busca} onChange={setBusca} />}
          {!filtrando && <ModoOrden activo={ordenando} onCambiar={setOrdenando} />}
          {GRUPOS.map((g) => {
            const grupo = lista.filter((t) => (t.categoriaSugerida ?? null) === g);
            const filas = filtrando ? grupo.filter((t) => visibles.includes(t)) : grupo;
            return filas.length ? (
              <Section key={g ?? 'sin'} title={g ? `${EMOJI_CATEGORIA_FUNCIONAL[g]} ${NOMBRE_CATEGORIA_FUNCIONAL[g]}` : 'Sin tipo de plata'}>
                <ListCard>
                  {filas.map((t, i) => (
                    <TxRow
                      key={t.id}
                      title={t.nombre}
                      amount=""
                      logo={{ emoji: emojiTipoElemento(t.nombre, t.categoriaSugerida) }}
                      accesorio={
                        filtrando || !ordenando ? undefined : (
                          <Ordenar
                            onSubir={i > 0 ? () => mover(grupo, i, -1) : undefined}
                            onBajar={i < grupo.length - 1 ? () => mover(grupo, i, 1) : undefined}
                          />
                        )
                      }
                      onPress={() => nav.go('CatalogoForm', { catalogo: 'tipoElemento', id: t.id })}
                    />
                  ))}
                </ListCard>
              </Section>
            ) : null;
          })}
          {filtrando && visibles.length === 0 && <EmptyState titulo="Nada coincide con la búsqueda" />}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
