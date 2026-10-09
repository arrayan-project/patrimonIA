import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  Button,
  DateField,
  ErrorText,
  MoneyField,
  MontoBanda,
  Nota,
  Opcionales,
  Pastilla,
  Question,
  Screen,
  Segmented,
  Select,
  useC,
} from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));

const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;
const CADA = [...INTERVALOS, 'ESPECIFICO'] as const;
// G35: cada opción se lee entera (antes "Mens… Trime…").
const NOMBRE_CADA: Record<(typeof CADA)[number], string> = {
  MENSUAL: '🗓️ Cada mes',
  TRIMESTRAL: 'Cada 3 meses',
  SEMESTRAL: 'Cada 6 meses',
  ANUAL: 'Cada año',
  ESPECIFICO: '📅 Entre dos fechas',
};

/**
 * Formulario de un presupuesto (plantillas de pantalla, R2 y R3): sin
 * `presupuestoId` crea; con él edita los montos esperados (lo único que se
 * puede cambiar de un presupuesto ya creado).
 */
export function PresupuestoFormScreen() {
  const c = useC();
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

  useTitulo(presupuestoId ? 'Cambiar montos' : undefined);

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

  // G35: sin numerar; el monto en una banda verde.
  const campoEntra = (
    <MoneyField label="📥 ¿Cuánto esperas que te entre?" value={ingresos} onChange={setIngresos} />
  );
  const campoSobra = <MoneyField label="🐷 ¿Cuánto quieres que te sobre?" value={ahorro} onChange={setAhorro} />;
  if (presupuestoId) {
    return (
      <Screen pie={<Button title="✏️ Guardar montos" onPress={guardarMontos} loading={busy} />}>
        <MontoBanda
          label="¿Cuánto piensas gastar?"
          value={gastos}
          onChange={setGastos}
          moneda={moneda}
          color={c.ok}
          emoji="🧾"
        />
        {campoEntra}
        {campoSobra}
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

  return (
    <Screen
      pie={
        <>
          {!hayMonto && <Nota>Escribe cuánto piensas gastar.</Nota>}
          <Button title="🧾 Crear presupuesto" onPress={crear} loading={busy} disabled={!listo} />
        </>
      }
    >
      <MontoBanda
        label="¿Cuánto piensas gastar?"
        value={gastos}
        onChange={setGastos}
        moneda={moneda}
        color={c.ok}
        emoji="🧾"
      />
      {/* HZ-22: la decisión que cambia el significado del registro va segunda. */}
      {hogarId && (
        <Segmented
          label="¿Es solo tuyo o del hogar?"
          options={['INDIVIDUAL', 'FAMILIAR'] as const}
          value={tipo}
          onChange={setTipo}
          formatearOpcion={(v) => (v === 'INDIVIDUAL' ? '🙋 Solo mío' : '👥 Del hogar')}
        />
      )}
      <View style={{ gap: 8 }}>
        <Question>¿Cada cuánto?</Question>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CADA.map((v) => (
            <Pastilla key={v} label={NOMBRE_CADA[v]} activo={cada === v} onPress={() => elegirCada(v)} />
          ))}
        </View>
      </View>
      {periodicidad === 'ESPECIFICO' && (
        <>
          <DateField label="¿Desde cuándo? (opcional)" value={fechaInicio} onChange={setFechaInicio} optional />
          <DateField label="¿Hasta cuándo? (opcional)" value={fechaFin} onChange={setFechaFin} optional />
        </>
      )}
      <Opcionales
        items={[
          { clave: 'entra', emoji: '📥', titulo: 'Lo que esperas que entre', abierto: !!ingresos, children: campoEntra },
          { clave: 'sobra', emoji: '🐷', titulo: 'Lo que quieres que sobre', abierto: !!ahorro, children: campoSobra },
          {
            clave: 'moneda',
            emoji: '💱',
            titulo: 'Otra moneda',
            abierto: moneda !== 'CLP',
            children: (
              <Select label="¿En qué moneda?" options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
            ),
          },
        ]}
      />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
