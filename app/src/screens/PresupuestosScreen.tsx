import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type DesviacionPresupuestariaDTO, type PresupuestoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money, porcentaje } from '../format';
import { Button, EmptyState, ErrorText, fechaLegible, GoalCard, Screen, Section, Skeleton } from '../ui';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * G35: el período de un presupuesto en palabras: "Octubre", "Octubre a
 * diciembre", "2026" o, si no calza con meses enteros, "1 oct 2026 al 15 dic 2026".
 */
export function nombrePeriodo(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return 'Sin fechas';
  if (!desde) return `Hasta el ${fechaLegible(hasta!)}`;
  if (!hasta) return `Desde el ${fechaLegible(desde)}`;
  const [ay, am, ad] = desde.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = hasta.slice(0, 10).split('-').map(Number);
  const finDeMes = bd === new Date(by, bm, 0).getDate();
  if (ad !== 1 || !finDeMes) return `${fechaLegible(desde)} al ${fechaLegible(hasta)}`;
  if (am === 1 && bm === 12 && ay === by) return String(ay);
  const anio = ay === by && ay === new Date().getFullYear() ? '' : ` ${by}`;
  const mes = (m: number) => MESES[m - 1];
  const nombre = am === bm && ay === by ? mes(am) : `${mes(am)} a ${mes(bm)}`;
  return nombre.charAt(0).toUpperCase() + nombre.slice(1) + anio;
}

export function PresupuestosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [lista, setLista] = useState<PresupuestoDTO[] | null>(null);
  // Lo gastado de cada uno, para la barra (las listas son cortas).
  const [desv, setDesv] = useState<Record<string, DesviacionPresupuestariaDTO>>({});
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const ps = await api.get<PresupuestoDTO[]>('/presupuestos', token);
      setLista(ps);
      const ds = await Promise.all(
        ps.map((p) =>
          api.get<DesviacionPresupuestariaDTO>(`/presupuestos/${p.id}/desviacion`, token).catch(() => null),
        ),
      );
      setDesv(Object.fromEntries(ps.flatMap((p, i) => (ds[i] ? [[p.id, ds[i]!]] : []))));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nuevo = () => nav.go('PresupuestoForm');
  const hay = (lista?.length ?? 0) > 0;

  return (
    <Screen onRefresh={cargar} pie={hay ? <Button title="🧾 Nuevo presupuesto" onPress={nuevo} /> : undefined}>
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
          ['Anteriores', lista.filter((p) => !p.vigente)],
        ] as const).map(([titulo, grupo]) =>
          grupo.length ? (
            <Section key={titulo} title={titulo}>
              {grupo.map((p) => {
                const d = desv[p.id];
                const gastado = d?.real.gastos ?? 0;
                const esperado = d?.esperado.gastos ?? p.gastosEsperados ?? 0;
                const pct = esperado > 0 ? (gastado / esperado) * 100 : 0;
                return (
                  <GoalCard
                    key={p.id}
                    emoji={p.estado === 'CERRADO' ? '🏁' : '🗓️'}
                    name={nombrePeriodo(p.fechaInicio, p.fechaFin)}
                    tag={p.tipo === 'FAMILIAR' ? '👥 Del hogar' : '🙋 Solo tuyo'}
                    hint={esperado > 0 ? porcentaje(pct) : undefined}
                    pct={pct}
                    ok={pct <= 100}
                    mal={pct > 100}
                    footLeft={`Llevas ${money(gastado, p.moneda)} de ${money(esperado, p.moneda)}`}
                    onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: p.id })}
                  />
                );
              })}
            </Section>
          ) : null,
        )
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
