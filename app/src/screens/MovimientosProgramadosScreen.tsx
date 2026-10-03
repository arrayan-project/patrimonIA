import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type MovimientoProgramadoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  aISO,
  Ayuda,
  Button,
  EmptyState,
  ErrorText,
  etiqueta,
  fechaLegible,
  ListCard,
  Screen,
  Section,
  Skeleton,
  TxRow,
} from '../ui';

const ICONO = {
  INGRESO: 'arrow-down-outline',
  GASTO: 'arrow-up-outline',
  TRANSFERENCIA: 'swap-horizontal-outline',
} as const;

/** Agrupa por tiempo (plantilla Lista): lo vencido primero, lo resuelto al final. */
function grupoDe(m: MovimientoProgramadoDTO, hoy: Date): string {
  if (m.estado !== 'PENDIENTE') return 'Ya resueltos';
  const f = m.fechaProgramada.slice(0, 10);
  if (f <= aISO(hoy)) return 'Por confirmar';
  const domingo = new Date(hoy);
  domingo.setDate(hoy.getDate() + ((7 - hoy.getDay()) % 7));
  if (f <= aISO(domingo)) return 'Esta semana';
  if (f.slice(0, 7) === aISO(hoy).slice(0, 7)) return 'Este mes';
  return 'Más adelante';
}

const GRUPOS = ['Por confirmar', 'Esta semana', 'Este mes', 'Más adelante', 'Ya resueltos'];

export function MovimientosProgramadosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [lista, setLista] = useState<MovimientoProgramadoDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<MovimientoProgramadoDTO[]>('/movimientos-programados', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nuevo = () => nav.go('NuevoProgramado');
  const hay = (lista?.length ?? 0) > 0;
  const hoy = new Date();
  const ordenados = [...(lista ?? [])].sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada));

  return (
    <Screen onRefresh={cargar} pie={hay ? <Button title="Programar movimiento" onPress={nuevo} /> : undefined}>
      <Ayuda>Se confirman cuando llega la fecha.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : !hay ? (
        <EmptyState
          icon="calendar-outline"
          titulo="Nada programado todavía"
          descripcion="Anota un sueldo o un gasto que viene y lo confirmas cuando toque."
          accion="Programar el primero"
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
                    title={m.observaciones || etiqueta(m.tipo)}
                    subtitle={`${etiqueta(m.tipo)} · ${fechaLegible(m.fechaProgramada)}${m.estado !== 'PENDIENTE' ? ` · ${etiqueta(m.estado)}` : ''}`}
                    amount={`${m.tipo === 'INGRESO' ? '+' : m.tipo === 'GASTO' ? '−' : ''}${money(m.montoPlanificado, m.moneda)}`}
                    positivo={m.tipo === 'INGRESO'}
                    logo={{ icon: ICONO[m.tipo] }}
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
