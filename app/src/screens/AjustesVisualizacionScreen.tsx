import { PREFERENCIAS_DEFAULT, SECCIONES_DASHBOARD, usePreferencias } from '../preferencias';
import { Interruptor, LinkButton, ListCard, Nota, Screen, useGuardarAlInstante } from '../ui';

/**
 * Qué secciones muestra el Inicio (GAPS.md G25; plantilla Ajustes, R5): cada
 * interruptor se guarda al tocarlo. Tema, fechas y moneda viven en Ajustes.
 */
export function AjustesVisualizacionScreen() {
  const { preferencias, guardarPreferencias } = usePreferencias();
  const guardar = useGuardarAlInstante();
  const cambiar = (dashboard: typeof preferencias.dashboard) =>
    void guardar(() => guardarPreferencias({ ...preferencias, dashboard }), () => undefined);

  return (
    <Screen>
      <Nota>Se guarda en tu cuenta: aplica en todos tus dispositivos.</Nota>
      <ListCard>
        {SECCIONES_DASHBOARD.map(([k, etiq]) => (
          <Interruptor
            key={k}
            titulo={etiq}
            value={preferencias.dashboard[k]}
            onChange={(v) => cambiar({ ...preferencias.dashboard, [k]: v })}
          />
        ))}
      </ListCard>
      <LinkButton title="Mostrar todas" onPress={() => cambiar(PREFERENCIAS_DEFAULT.dashboard)} />
    </Screen>
  );
}
