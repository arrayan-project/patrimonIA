import { useEffect, useState } from 'react';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  AmountInput,
  Button,
  contadorPasos,
  DateField,
  ErrorText,
  etiqueta,
  MoneyField,
  Nota,
  Opcional,
  Screen,
  Segmented,
  Select,
} from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));

const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;
const CADA = [...INTERVALOS, 'ESPECIFICO'] as const;

/**
 * Formulario de un presupuesto (plantillas de pantalla, R2 y R3): sin
 * `presupuestoId` crea; con él edita los montos esperados (lo único que se
 * puede cambiar de un presupuesto ya creado).
 */
export function PresupuestoFormScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const presupuestoId = nav.route.params?.presupuestoId as string | undefined;
  const inicial = (k: string) => {
    const v = nav.route.params?.[k] as number | null | undefined;
    return v == null ? '' : String(v);
  };
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tipo, setTipo] = useState<'INDIVIDUAL' | 'FAMILIAR'>('INDIVIDUAL');
  const [periodicidad, setPeriodicidad] = useState<'PERIODICO' | 'ESPECIFICO'>('PERIODICO');
  const [intervalo, setIntervalo] = useState<(typeof INTERVALOS)[number]>('MENSUAL');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [ingresos, setIngresos] = useState(inicial('ingresos'));
  const [gastos, setGastos] = useState(inicial('gastos'));
  const [ahorro, setAhorro] = useState(inicial('ahorro'));
  const [moneda, setMoneda] = useState((nav.route.params?.moneda as string | undefined) ?? 'CLP');

  useTitulo(presupuestoId ? 'Editar montos' : undefined);

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) => setHogarId(hs[0]?.id ?? null))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const guardarMontos = async () => {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = { presupuestoId };
      if (num(ingresos) !== undefined) body.ingresosEsperados = num(ingresos);
      if (num(gastos) !== undefined) body.gastosEsperados = num(gastos);
      if (num(ahorro) !== undefined) body.ahorroEsperado = num(ahorro);
      await api.post('/comandos/ActualizarDatosPresupuesto', body, token);
      toast.mostrar('Guardado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

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
  if (presupuestoId) {
    return (
      <Screen pie={<Button title="Guardar montos" onPress={guardarMontos} loading={busy} />}>
        <AmountInput label="¿Cuánto esperas gastar?" paso={paso()} value={gastos} onChange={setGastos} moneda={moneda} />
        <MoneyField label="¿Cuánto esperas ingresar? (opcional)" paso={paso()} value={ingresos} onChange={setIngresos} />
        <MoneyField label="¿Cuánto esperas ahorrar? (opcional)" paso={paso()} value={ahorro} onChange={setAhorro} />
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  // Un solo "¿cada cuánto?": el intervalo, o fechas específicas.
  const cada = periodicidad === 'ESPECIFICO' ? 'ESPECIFICO' : intervalo;
  const elegirCada = (v: (typeof CADA)[number]) => {
    if (v === 'ESPECIFICO') setPeriodicidad('ESPECIFICO');
    else {
      setPeriodicidad('PERIODICO');
      setIntervalo(v);
    }
  };
  const hayMonto = [gastos, ingresos, ahorro].some((x) => Number(x) > 0);
  const listo = hayMonto && (tipo !== 'FAMILIAR' || !!hogarId);
  const resumen = !hayMonto
    ? 'Completa cuánto esperas gastar.'
    : `${tipo === 'FAMILIAR' ? 'Del hogar' : 'Solo tuyo'}, ${
        periodicidad === 'ESPECIFICO' ? 'entre las fechas que elijas' : `${etiqueta(intervalo).toLowerCase()}`
      }. Te mostramos cómo vas contra lo real.`;

  return (
    <Screen
      pie={
        <>
          <Nota>{resumen}</Nota>
          <Button title="Crear presupuesto" onPress={crear} loading={busy} disabled={!listo} />
        </>
      }
    >
      <AmountInput
        label="¿Cuánto esperas gastar?"
        paso={paso({ hecho: hayMonto })}
        value={gastos}
        onChange={setGastos}
        moneda={moneda}
      />
      {/* HZ-22: la decisión que cambia el significado del registro va en el paso 2. */}
      {hogarId && (
        <Segmented
          label="¿Es solo tuyo o del hogar?"
          paso={paso({ hecho: true })}
          options={['INDIVIDUAL', 'FAMILIAR'] as const}
          value={tipo}
          onChange={setTipo}
          formatearOpcion={(v) => (v === 'INDIVIDUAL' ? 'Solo mío' : 'Del hogar')}
        />
      )}
      <Segmented
        label="¿Cada cuánto?"
        paso={paso({ hecho: true })}
        options={CADA}
        value={cada}
        onChange={elegirCada}
        formatearOpcion={(v) => (v === 'ESPECIFICO' ? 'Fechas específicas' : etiqueta(v))}
      />
      {periodicidad === 'ESPECIFICO' && (
        <>
          <DateField label="¿Desde cuándo? (opcional)" value={fechaInicio} onChange={setFechaInicio} optional />
          <DateField label="¿Hasta cuándo? (opcional)" value={fechaFin} onChange={setFechaFin} optional />
        </>
      )}
      <Opcional titulo="Agregar ingresos y ahorro esperados" abierto={!!ingresos || !!ahorro}>
        <MoneyField label="¿Cuánto esperas ingresar? (opcional)" value={ingresos} onChange={setIngresos} />
        <MoneyField label="¿Cuánto esperas ahorrar? (opcional)" value={ahorro} onChange={setAhorro} />
      </Opcional>
      <Opcional titulo="Usar otra moneda" abierto={moneda !== 'CLP'}>
        <Select label="¿En qué moneda?" options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
      </Opcional>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
