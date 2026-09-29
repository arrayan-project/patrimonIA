import { useState } from 'react';
import { ApiError } from '../api/client';
import { MONEDAS_FRECUENTES } from '../labels';
import { useNav } from '../navigation/navigator';
import { PREFERENCIAS_DEFAULT, SECCIONES_DASHBOARD, usePreferencias } from '../preferencias';
import { useToast } from '../ui/Toast';
import { Ayuda, Button, ErrorText, GroupLabel, Screen, Segmented, Select, Title, type FormatoFecha } from '../ui';

const OPC_FECHA: FormatoFecha[] = ['legible', 'numerico'];
const ETIQUETA_FECHA: Record<FormatoFecha, string> = { legible: '15 mar 2026', numerico: '15-03-2026' };
const SIN_PREFERENCIA = '';
const OPC_MONEDA = [
  { value: SIN_PREFERENCIA, label: 'La primera que tenga' },
  ...MONEDAS_FRECUENTES.map((m) => ({ value: m, label: m })),
];

/** Preferencias personales de visualización (GAPS.md G25). Vive en Ajustes › Apariencia. */
export function AjustesVisualizacionScreen() {
  const nav = useNav();
  const toast = useToast();
  const { preferencias, guardarPreferencias } = usePreferencias();
  const [p, setP] = useState(preferencias);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sucio = JSON.stringify(p) !== JSON.stringify(preferencias);

  const guardar = async () => {
    setBusy(true);
    setError('');
    try {
      await guardarPreferencias(p);
      toast.mostrar('Preferencias guardadas');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title>Visualización</Title>
      <Ayuda>Cómo ves la app. Se guarda en tu cuenta: aplica en todos tus dispositivos.</Ayuda>

      <Segmented
        label="Formato de fecha"
        options={OPC_FECHA}
        value={p.formatoFecha}
        onChange={(formatoFecha) => setP({ ...p, formatoFecha })}
        formatearOpcion={(v) => ETIQUETA_FECHA[v]}
      />

      <Select
        label="Moneda principal en Inicio"
        value={p.monedaPreferida ?? SIN_PREFERENCIA}
        options={OPC_MONEDA}
        onChange={(v) => setP({ ...p, monedaPreferida: v.trim().toUpperCase() || null })}
        permiteOtro
      />
      <Ayuda>Si tienes cuentas en varias monedas, cuál mostrar primero. No convierte montos.</Ayuda>

      <GroupLabel>Secciones del Inicio</GroupLabel>
      {SECCIONES_DASHBOARD.map(([k, etiq]) => (
        <Segmented
          key={k}
          label={etiq}
          options={['Mostrar', 'Ocultar'] as const}
          value={p.dashboard[k] ? 'Mostrar' : 'Ocultar'}
          onChange={(v) => setP({ ...p, dashboard: { ...p.dashboard, [k]: v === 'Mostrar' } })}
          formatearOpcion={(v) => v}
        />
      ))}

      <ErrorText>{error}</ErrorText>
      <Button title="Guardar preferencias" onPress={guardar} loading={busy} disabled={!sucio} />
      <Button
        title="Volver a los valores por defecto"
        variant="secondary"
        onPress={() => setP(PREFERENCIAS_DEFAULT)}
      />
    </Screen>
  );
}
