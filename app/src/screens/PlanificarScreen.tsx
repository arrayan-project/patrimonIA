import { useNav } from '../navigation/navigator';
import { GroupLabel, MenuLink, Screen, Title } from '../ui';

/** Tab "Planificar": todo lo que mira hacia adelante — metas, presupuestos, moldes. */
export function PlanificarScreen() {
  const nav = useNav();
  return (
    <Screen>
      <Title>Planificar</Title>

      <GroupLabel>Metas</GroupLabel>
      <MenuLink
        icon="flag-outline"
        title="Objetivos financieros"
        subtitle="Metas de ahorro con reservas y progreso"
        onPress={() => nav.go('Objetivos')}
      />

      <GroupLabel>Presupuesto y flujo</GroupLabel>
      <MenuLink
        icon="pie-chart-outline"
        title="Presupuestos"
        subtitle="Esperado vs. real, con seguimiento por rubro"
        onPress={() => nav.go('Presupuestos')}
      />
      <MenuLink
        icon="calendar-outline"
        title="Movimientos programados"
        subtitle="Ingresos futuros con fecha, listos para materializar"
        onPress={() => nav.go('MovimientosProgramados')}
      />
      <MenuLink
        icon="copy-outline"
        title="Plantillas de movimiento"
        subtitle="Moldes para el gasto o ingreso de siempre"
        onPress={() => nav.go('Plantillas')}
      />

      <GroupLabel>Seguimiento</GroupLabel>
      <MenuLink
        icon="trending-up-outline"
        title="Evolución de mi patrimonio"
        subtitle="Cómo cambió tu patrimonio en el tiempo"
        onPress={() => nav.go('EvolucionPatrimonio')}
      />
    </Screen>
  );
}
