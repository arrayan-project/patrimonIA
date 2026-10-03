import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  Button,
  contadorPasos,
  DateField,
  ErrorText,
  MoneyField,
  Screen,
  Segmented,
  Select,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));

const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;

/** Formulario de un presupuesto nuevo (plantillas de pantalla, R2: ya no vive bajo la lista). */
export function NuevoPresupuestoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tipo, setTipo] = useState<'INDIVIDUAL' | 'FAMILIAR'>('INDIVIDUAL');
  const [periodicidad, setPeriodicidad] = useState<'PERIODICO' | 'ESPECIFICO'>('PERIODICO');
  const [intervalo, setIntervalo] = useState<(typeof INTERVALOS)[number]>('MENSUAL');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [ingresos, setIngresos] = useState('');
  const [gastos, setGastos] = useState('');
  const [ahorro, setAhorro] = useState('');
  const [moneda, setMoneda] = useState('CLP');

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) => setHogarId(hs[0]?.id ?? null))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const crear = async () => {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = { tipo, periodicidad };
      if (tipo === 'FAMILIAR') body.hogarId = hogarId;
      if (periodicidad === 'PERIODICO') body.intervalo = intervalo;
      if (periodicidad === 'ESPECIFICO') {
        if (fechaInicio.trim()) body.fechaInicio = fechaInicio.trim();
        if (fechaFin.trim()) body.fechaFin = fechaFin.trim();
      }
      if (num(ingresos) !== undefined) body.ingresosEsperados = num(ingresos);
      if (num(gastos) !== undefined) body.gastosEsperados = num(gastos);
      if (num(ahorro) !== undefined) body.ahorroEsperado = num(ahorro);
      if (moneda !== 'CLP') body.moneda = moneda.trim().toUpperCase();
      await api.post('/comandos/CrearPresupuesto', body, token);
      toast.mostrar('Presupuesto creado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  // HZ-19: numera las preguntas del formulario en el orden en que se muestran.
  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <Button
          title="Crear presupuesto"
          onPress={crear}
          loading={busy}
          disabled={tipo === 'FAMILIAR' && !hogarId}
        />
      }
    >
      <Segmented label="Tipo" options={['INDIVIDUAL', 'FAMILIAR'] as const} value={tipo} onChange={setTipo} paso={paso()} />
      {tipo === 'FAMILIAR' && !hogarId && (
        <Text style={styles.muted}>Necesitas pertenecer a un hogar para un presupuesto familiar.</Text>
      )}
      <Segmented
        label="Periodicidad"
        paso={paso()}
        options={['PERIODICO', 'ESPECIFICO'] as const}
        value={periodicidad}
        onChange={setPeriodicidad}
      />
      {periodicidad === 'PERIODICO' ? (
        <Segmented label="Intervalo" paso={paso()} options={INTERVALOS} value={intervalo} onChange={setIntervalo} />
      ) : (
        <>
          <DateField label="Inicio (opcional)" paso={paso()} value={fechaInicio} onChange={setFechaInicio} optional />
          <DateField label="Fin (opcional)" paso={paso()} value={fechaFin} onChange={setFechaFin} optional />
        </>
      )}
      <Select label="Moneda" paso={paso()} options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
      <MoneyField label="Ingresos esperados" paso={paso()} value={ingresos} onChange={setIngresos} moneda={moneda} />
      <MoneyField label="Gastos esperados" paso={paso()} value={gastos} onChange={setGastos} moneda={moneda} />
      <MoneyField label="Ahorro esperado" paso={paso()} value={ahorro} onChange={setAhorro} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  muted: tipoDe(c).nota,
});
