import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MovimientoProgramadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { EMOJI_ANOTAR, emojiCategoria } from '../emojis';
import { aISO, Button, fechaLegible, EmptyState, ErrorText, ListCard, Screen, Section, Skeleton, TxRow } from '../ui';

/** Agrupa por tiempo (plantilla Lista): lo vencido primero, lo resuelto al final. */
function grupoDe(m: MovimientoProgramadoDTO, hoy: Date): string {
  if (m.estado !== 'PENDIENTE') return '✅ Ya resueltos';
  const f = m.fechaProgramada.slice(0, 10);
  if (f <= aISO(hoy)) return '⏰ Por confirmar';
  const domingo = new Date(hoy);
  domingo.setDate(hoy.getDate() + ((7 - hoy.getDay()) % 7));
  if (f <= aISO(domingo)) return 'Esta semana';
  if (f.slice(0, 7) === aISO(hoy).slice(0, 7)) return 'Este mes';
  return 'Más adelante';
}

const GRUPOS = ['⏰ Por confirmar', 'Esta semana', 'Este mes', 'Más adelante', '✅ Ya resueltos'];

/** "5 nov" (sin año si es este año). */
export function fechaCorta(iso: string): string {
  return fechaLegible(iso).replace(` ${new Date().getFullYear()}`, '');
}

/** G35: el nombre de un programado: su detalle, su categoría o "Gasto desde Cuenta corriente". */
export function tituloProgramado(
  m: MovimientoProgramadoDTO,
  categorias: CategoriaMovimientoDTO[],
  elementos: ElementoPatrimonialDTO[],
): string {
  if (m.observaciones) return m.observaciones;
  const cat = categorias.find((x) => x.id === m.categoriaId);
  if (cat) return cat.nombre;
  const desde = elementos.find((e) => e.id === m.elementoOrigenId)?.nombre;
  const hacia = elementos.find((e) => e.id === m.elementoDestinoId)?.nombre;
  if (m.tipo === 'GASTO') return desde ? `Gasto desde ${desde}` : 'Gasto';
  if (m.tipo === 'INGRESO') return hacia ? `Ingreso a ${hacia}` : 'Ingreso';
  return desde && hacia ? `De ${desde} a ${hacia}` : 'Moví plata';
}

export function MovimientosProgramadosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [lista, setLista] = useState<MovimientoProgramadoDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<MovimientoProgramadoDTO[]>('/movimientos-programados', token));
      // G35: el nombre de la fila sale de la categoría o la cuenta si no hay detalle.
      const [propios, delHogar] = await Promise.all(
        ['propietario=me', 'alcance=hogar'].map((q) =>
          api.get<ElementoPatrimonialDTO[]>(`/elementos-patrimoniales?${q}`, token).catch(() => []),
        ),
      );
      setElementos([...propios, ...delHogar]);
      setCategorias(
        await api
          .get<HogarDTO[]>('/usuarios/me/hogares', token)
          .then((hs) =>
            hs[0] ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hs[0].id}/categorias-movimiento`, token) : [],
          )
          .catch(() => []),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nuevo = () => nav.go('NuevoProgramado');
  const hay = (lista?.length ?? 0) > 0;
  const hoy = new Date();
  const ordenados = [...(lista ?? [])].sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada));

  const titulo = (m: MovimientoProgramadoDTO) => tituloProgramado(m, categorias, elementos);
  const subtitulo = (m: MovimientoProgramadoDTO) => {
    const f = fechaCorta(m.fechaProgramada);
    const ingreso = m.tipo === 'INGRESO';
    if (m.estado === 'MATERIALIZADO') return `✅ ${ingreso ? 'Llegó' : m.tipo === 'GASTO' ? 'Pagado' : 'Hecho'} · ${f}`;
    if (m.estado === 'CANCELADO') return `❌ Cancelado · ${f}`;
    const repite = m.periodicidad ? ` · 🔁 Cada ${m.periodicidad === 'MENSUAL' ? 'mes' : 'año'}` : '';
    if (m.fechaProgramada.slice(0, 10) <= aISO(hoy)) return `⏰ Era el ${f} · ${ingreso ? '¿llegó?' : '¿se pagó?'}`;
    return `📅 ${f}${repite}`;
  };

  return (
    <Screen onRefresh={cargar} pie={hay ? <Button title="🗓️ Programar movimiento" onPress={nuevo} /> : undefined}>
      {lista === null ? (
        <Skeleton />
      ) : !hay ? (
        <EmptyState
          icon="calendar-outline"
          titulo="🗓️ Nada programado todavía"
          descripcion="Anota un sueldo o una cuenta que viene y te avisamos cuando toque."
          accion="🗓️ Programar el primero"
          onAccion={nuevo}
        />
      ) : (
        GRUPOS.map((g) => {
          const filas = ordenados.filter((m) => grupoDe(m, hoy) === g);
          return filas.length ? (
            <Section key={g} title={g}>
              <ListCard>
                {filas.map((m) => (
                  <TxRow
                    key={m.id}
                    title={titulo(m)}
                    subtitle={subtitulo(m)}
                    amount={`${m.tipo === 'INGRESO' ? '+' : m.tipo === 'GASTO' ? '−' : ''}${money(m.montoPlanificado, m.moneda)}`}
                    positivo={m.tipo === 'INGRESO' && m.estado !== 'CANCELADO'}
                    logo={{
                      emoji: emojiCategoria(categorias.find((x) => x.id === m.categoriaId)) ?? EMOJI_ANOTAR[m.tipo],
                    }}
                    onPress={() => nav.go('MovimientoProgramadoDetalle', { movimientoId: m.id })}
                  />
                ))}
              </ListCard>
            </Section>
          ) : null;
        })
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
