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
import { money, porcentaje } from '../format';
import { TarjetaMeta } from './ObjetivosScreen';
import {
  Dato,
  Datos,
  EmptyState,
  ErrorText,
  GoalCard,
  IconButton,
  ListCard,
  MenuList,
  Hero,
  ProgressBar,
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
  // Una cifra por moneda (no se convierten); arriba la que tiene más metas.
  const porMoneda = [...new Set(enProgreso.map((o) => o.moneda))]
    .map((moneda) => {
      const de = enProgreso.filter((o) => o.moneda === moneda);
      return {
        moneda,
        n: de.length,
        llevas: de.reduce((s, o) => s + o.progreso, 0),
        meta: de.reduce((s, o) => s + o.montoObjetivo, 0),
      };
    })
    .sort((a, b) => b.n - a.n);
  const completados = (objetivos ?? []).filter((o) => o.estado === 'COMPLETADO').length;
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
            <IconButton icon="add" accessibilityLabel="Nueva meta" onPress={() => nav.go('MetaForm')} />
          </>
        }
      />
      {/* Plantilla Resumen: una cifra — cuánto llevas guardado en tus metas activas
          (G35: debajo, la resta que la explica; otras monedas en su propia línea). */}
      {porMoneda.length > 0 && (
        <Hero
          label="🐷 Guardado para metas"
          value={money(porMoneda[0].llevas, porMoneda[0].moneda)}
          debajo={
            <Datos plano>
              <Dato etiqueta="🎯 Quieres juntar" valor={money(porMoneda[0].meta, porMoneda[0].moneda)} />
              <Dato
                etiqueta="⏳ Te faltan"
                valor={money(Math.max(porMoneda[0].meta - porMoneda[0].llevas, 0), porMoneda[0].moneda)}
              />
              {porMoneda.slice(1).map((m) => (
                <Dato
                  key={m.moneda}
                  etiqueta={`💱 Además, en ${m.moneda}`}
                  valor={`${money(m.llevas, m.moneda)} de ${money(m.meta, m.moneda)}`}
                />
              ))}
              {completados > 0 ? (
                <Dato etiqueta="✅ Metas cumplidas" valor={String(completados)} />
              ) : null}
            </Datos>
          }
        >
          <ProgressBar pct={porMoneda[0].meta > 0 ? (porMoneda[0].llevas / porMoneda[0].meta) * 100 : 0} />
        </Hero>
      )}

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
                onAccion={() => nav.go('MetaForm')}
              />
            ) : (
              enProgreso.map((o) => <TarjetaMeta key={o.id} o={o} />)
            )}
          </Section>

          {sinMeta.length > 0 && (
            <Section title="Ahorro sin meta">
              <ListCard>
                <TxRow
                  title="Ahorro sin meta"
                  subtitle={`${sinMeta.length} ${sinMeta.length === 1 ? 'ahorro' : 'ahorros'}`}
                  amount={money(totalSinMeta, monedaSinMeta)}
                  logo={{ emoji: '🐷' }}
                  onPress={() => nav.go('Asignaciones')}
                />
              </ListCard>
            </Section>
          )}

          {desv && presupuesto ? (
            <Section
              title={`Presupuesto de ${MESES[hoy.getMonth()]}`}
              accion="Ver todos"
              onAccion={() => nav.go('Presupuestos')}
            >
              <GoalCard
                name="Llevas gastado"
                emoji="🧾"
                hint={porcentaje(gastoPct)}
                pct={gastoPct}
                ok={gastoPct <= 100}
                footLeft={`${money(desv.real.gastos, presupuesto.moneda)} de ${money(desv.esperado.gastos, presupuesto.moneda)}`}
                tag={
                  desv.real.gastos <= desv.esperado.gastos
                    ? `✅ Te quedan ${money(desv.esperado.gastos - desv.real.gastos, presupuesto.moneda)}`
                    : `⚠️ Te pasaste ${money(desv.real.gastos - desv.esperado.gastos, presupuesto.moneda)}`
                }
                onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: presupuesto.id })}
              />
            </Section>
          ) : (
            <Section title="Presupuesto">
              <ListCard>
                <TxRow
                  title="Sin presupuesto vigente"
                  subtitle="Crea uno para comparar lo que gastas"
                  amount=""
                  logo={{ emoji: '🧾' }}
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
              emoji: '🗓️',
              onPress: () => nav.go('MovimientosProgramados'),
            },
            {
              title: 'Frecuentes',
              subtitle: 'Lo de siempre, a un toque al registrar',
              emoji: '⚡',
              onPress: () => nav.go('Plantillas'),
            },
          ]}
        />
      </Section>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
