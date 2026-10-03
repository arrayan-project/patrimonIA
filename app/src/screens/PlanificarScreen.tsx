import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type DesviacionPresupuestariaDTO,
  type MovimientoProgramadoDTO,
  type ObjetivoFinancieroDTO,
  type PresupuestoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  EmptyState,
  ErrorText,
  GoalCard,
  IconButton,
  ListCard,
  MenuList,
  PillDate,
  Screen,
  Section,
  Skeleton,
  Title,
  TopRow,
  TxRow,
} from '../ui';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function diasRestantes(fecha: string | null): string | undefined {
  if (!fecha) return undefined;
  const d = Math.round((new Date(`${fecha}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  return `${d}d`;
}

/** Tab "Planificar": sólo lo prospectivo — objetivos, lo apartado, presupuesto. */
export function PlanificarScreen() {
  const { token } = useSession();
  const nav = useNav();

  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[] | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  const [presupuesto, setPresupuesto] = useState<PresupuestoDTO | null>(null);
  const [desv, setDesv] = useState<DesviacionPresupuestariaDTO | null>(null);
  const [programados, setProgramados] = useState<MovimientoProgramadoDTO[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [objs, asgs] = await Promise.all([
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
        api.get<AsignacionDTO[]>('/asignaciones', token).catch(() => []),
      ]);
      setObjetivos(objs);
      setAsignaciones(asgs);
      api
        .get<MovimientoProgramadoDTO[]>('/movimientos-programados', token)
        .then(setProgramados)
        .catch(() => setProgramados([]));
      try {
        const presus = await api.get<PresupuestoDTO[]>('/presupuestos', token);
        const vig = presus.find((p) => p.vigente && p.estado !== 'CERRADO') ?? null;
        setPresupuesto(vig);
        setDesv(
          vig ? await api.get<DesviacionPresupuestariaDTO>(`/presupuestos/${vig.id}/desviacion`, token) : null,
        );
      } catch {
        setPresupuesto(null);
        setDesv(null);
      }
      try {
        const { noLeidas: n } = await api.get<{ noLeidas: number }>(
          '/usuarios/me/notificaciones/no-leidas',
          token,
        );
        setNoLeidas(n);
      } catch {
        setNoLeidas(0);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const enProgreso = (objetivos ?? []).filter((o) => o.estado === 'EN_PROGRESO');
  const completados = (objetivos ?? []).filter((o) => o.estado === 'COMPLETADO').length;
  const monedasUnicas = new Set(enProgreso.map((o) => o.moneda));
  const meta = enProgreso.reduce((s, o) => s + o.montoObjetivo, 0);
  const avance = enProgreso.reduce((s, o) => s + o.progreso, 0);
  const pctTotal = meta > 0 ? Math.round((avance / meta) * 100) : 0;
  const hoy = new Date();

  // D-4: lo ahorrado en metas ya se ve en cada meta; aquí solo el ahorro sin meta.
  const sinMeta = asignaciones.filter((a) => !a.objetivoId);
  const totalSinMeta = sinMeta.reduce((s, a) => s + a.totalReservado, 0);
  const monedaSinMeta = sinMeta[0]?.moneda ?? 'CLP';
  const gastoPct =
    desv && desv.esperado.gastos > 0 ? Math.round((desv.real.gastos / desv.esperado.gastos) * 100) : 0;

  return (
    <Screen onRefresh={cargar}>
      <TopRow
        left={<Title>Planificar</Title>}
        right={
          <>
            <IconButton
              icon="notifications-outline"
              badge={noLeidas || undefined}
              accessibilityLabel="Notificaciones"
              onPress={() => nav.go('Notificaciones')}
            />
            <IconButton icon="settings-outline" accessibilityLabel="Ajustes" onPress={() => nav.go('Ajustes')} />
            <IconButton icon="add" accessibilityLabel="Nueva meta" onPress={() => nav.go('NuevaMeta')} />
          </>
        }
      />
      <PillDate icon="flag-outline">
        {`${enProgreso.length} ${enProgreso.length === 1 ? 'meta activa' : 'metas activas'}`}
        {completados > 0 ? ` · ${completados} ${completados === 1 ? 'cumplida' : 'cumplidas'}` : ''}
      </PillDate>

      {objetivos === null ? (
        <Skeleton filas={2} />
      ) : (
        <>
          <Section title="Metas" accion="Ver todas" onAccion={() => nav.go('Objetivos')}>
            {enProgreso.length === 0 ? (
              <EmptyState
                icon="flag-outline"
                titulo="Sin metas activas"
                descripcion="Crea una meta para seguir su avance acá."
                accion="Crear meta"
                onAccion={() => nav.go('NuevaMeta')}
              />
            ) : (
              <>
                {monedasUnicas.size === 1 && enProgreso.length > 1 && (
                  <GoalCard
                    name={`Avance total · ${enProgreso.length} metas`}
                    hint={`${pctTotal}%`}
                    pct={pctTotal}
                    footLeft={`${money(avance, [...monedasUnicas][0])} de ${money(meta, [...monedasUnicas][0])}`}
                  />
                )}
                {enProgreso.map((o) => (
                  <GoalCard
                    key={o.id}
                    name={o.hogarId ? `${o.nombre} · hogar` : o.nombre}
                    hint={`${o.progresoPorcentaje}%`}
                    pct={o.progresoPorcentaje}
                    ok={o.progresoPorcentaje >= 100}
                    footLeft={`${money(o.progreso, o.moneda)} de ${money(o.montoObjetivo, o.moneda)}`}
                    footRight={diasRestantes(o.fechaObjetivo)}
                    onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
                  />
                ))}
              </>
            )}
          </Section>

          {sinMeta.length > 0 && (
            <Section title="Ahorro sin meta" accion="Ver detalle" onAccion={() => nav.go('Asignaciones')}>
              <ListCard>
                <TxRow
                  title="Ahorro sin meta"
                  subtitle={`${sinMeta.length} ${sinMeta.length === 1 ? 'ahorro' : 'ahorros'}`}
                  amount={money(totalSinMeta, monedaSinMeta)}
                  logo={{ icon: 'umbrella-outline' }}
                  onPress={() => nav.go('Asignaciones')}
                />
              </ListCard>
            </Section>
          )}

          {desv && presupuesto ? (
            <Section
              title={`Presupuesto de ${MESES[hoy.getMonth()]}`}
              onAccion={() => nav.go('Presupuestos')}
            >
              <GoalCard
                name="Gasto total"
                hint={`${gastoPct}%`}
                pct={gastoPct}
                ok={gastoPct <= 100}
                footLeft={`${money(desv.real.gastos, presupuesto.moneda)} gastado`}
                footRight={`de ${money(desv.esperado.gastos, presupuesto.moneda)}`}
                onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: presupuesto.id })}
              />
            </Section>
          ) : (
            <Section title="Presupuesto">
              <ListCard>
                <TxRow
                  title="Sin presupuesto vigente"
                  subtitle="Crea uno para comparar lo que gastas"
                  amount="›"
                  logo={{ icon: 'pie-chart-outline' }}
                  onPress={() => nav.go('Presupuestos')}
                />
              </ListCard>
            </Section>
          )}
        </>
      )}

      {/* G32 H-06 — lo programado es planificación: vive acá, no en Movimientos. */}
      <Section title="Pagos y cobros futuros">
        <MenuList
          items={[
            {
              title: 'Movimientos programados',
              subtitle: (() => {
                const n = programados.filter((p) => p.estado === 'PENDIENTE').length;
                return n > 0
                  ? `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`
                  : 'Ingresos y gastos futuros con fecha';
              })(),
              icon: 'calendar-outline',
              onPress: () => nav.go('MovimientosProgramados'),
            },
            {
              title: 'Plantillas de movimiento',
              subtitle: 'Moldes para el gasto o ingreso de siempre',
              icon: 'copy-outline',
              onPress: () => nav.go('Plantillas'),
            },
          ]}
        />
      </Section>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
