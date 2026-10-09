import { StyleSheet, View } from 'react-native';
import { PREFERENCIAS_DEFAULT, usePreferencias, type SeccionDashboard } from '../preferencias';
import { Interruptor, ListCard, Nota, Pastilla, Screen, useGuardarAlInstante } from '../ui';

/** G35: cada sección con su emoji y qué muestra, en el orden en que aparecen en el Inicio. */
const SECCIONES: { k: SeccionDashboard; emoji: string; titulo: string; sub: string }[] = [
  { k: 'disponibilidad', emoji: '✅', titulo: 'Puedes gastar', sub: 'Debajo del total' },
  { k: 'composicion', emoji: '🏦', titulo: 'Tus cuentas', sub: 'Cada cuenta con su saldo' },
  { k: 'objetivos', emoji: '🎯', titulo: 'Tus metas', sub: 'Cuánto llevas de cada una' },
  { k: 'flujo', emoji: '📊', titulo: 'Así va el mes', sub: 'Lo que entró y salió' },
  { k: 'accesos', emoji: '⚡', titulo: 'Atajos', sub: 'Lo que más usas, a un toque' },
];

/**
 * Qué secciones muestra el Inicio (GAPS.md G25; plantilla Ajustes, R5): cada
 * interruptor se guarda al tocarlo. Tema, fechas y moneda viven en Ajustes.
 */
export function AjustesVisualizacionScreen() {
  const { preferencias, guardarPreferencias } = usePreferencias();
  const guardar = useGuardarAlInstante();
  const cambiar = (dashboard: typeof preferencias.dashboard) =>
    void guardar(() => guardarPreferencias({ ...preferencias, dashboard }), () => undefined);
  const algunaOculta = SECCIONES.some(({ k }) => !preferencias.dashboard[k]);

  return (
    <Screen>
      <ListCard>
        {SECCIONES.map(({ k, emoji, titulo, sub }) => (
          <Interruptor
            key={k}
            emoji={emoji}
            titulo={titulo}
            sub={sub}
            value={preferencias.dashboard[k]}
            onChange={(v) => cambiar({ ...preferencias.dashboard, [k]: v })}
          />
        ))}
      </ListCard>
      {algunaOculta && (
        <View style={styles.pastillas}>
          <Pastilla label="👀 Mostrar todas" onPress={() => cambiar(PREFERENCIAS_DEFAULT.dashboard)} />
        </View>
      )}
      <Nota>📱 Se ve igual en todos tus teléfonos.</Nota>
    </Screen>
  );
}

const styles = StyleSheet.create({ pastillas: { flexDirection: 'row' } });
