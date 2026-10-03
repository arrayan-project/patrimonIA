import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type PresupuestoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
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

export function PresupuestosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [lista, setLista] = useState<PresupuestoDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<PresupuestoDTO[]>('/presupuestos', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nuevo = () => nav.go('NuevoPresupuesto');
  const hay = (lista?.length ?? 0) > 0;

  const contexto = (p: PresupuestoDTO) => {
    const rango =
      p.fechaInicio || p.fechaFin
        ? `${p.fechaInicio ? fechaLegible(p.fechaInicio) : '—'} → ${p.fechaFin ? fechaLegible(p.fechaFin) : '—'}`
        : null;
    return [etiqueta(p.tipo), rango, p.estado ? etiqueta(p.estado) : null].filter(Boolean).join(' · ');
  };

  return (
    <Screen onRefresh={cargar} pie={hay ? <Button title="Nuevo presupuesto" onPress={nuevo} /> : undefined}>
      <Ayuda>Lo que esperas en un período, contra lo real.</Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : !hay ? (
        <EmptyState
          icon="pie-chart-outline"
          titulo="Todavía no tienes presupuestos"
          descripcion="Fija cuánto quieres gastar al mes y te mostramos cómo vas."
          accion="Crear el primero"
          onAccion={nuevo}
        />
      ) : (
        ([
          ['Vigentes', lista.filter((p) => p.vigente)],
          ['Fuera de vigencia', lista.filter((p) => !p.vigente)],
        ] as const).map(([titulo, grupo]) =>
          grupo.length ? (
            <Section key={titulo} title={titulo}>
              <ListCard>
                {grupo.map((p) => (
                  <TxRow
                    key={p.id}
                    title={p.periodicidad === 'PERIODICO' ? etiqueta(p.intervalo ?? '') : 'Específico'}
                    subtitle={contexto(p)}
                    amount={p.gastosEsperados != null ? money(p.gastosEsperados, p.moneda) : ''}
                    logo={{ icon: 'pie-chart-outline' }}
                    onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: p.id })}
                  />
                ))}
              </ListCard>
            </Section>
          ) : null,
        )
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
