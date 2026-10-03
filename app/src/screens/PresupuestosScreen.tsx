import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type PresupuestoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  contadorPasos,
  Ayuda,
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorText,
  etiqueta,
  LinkButton,
  MoneyField,
  Skeleton,
  Screen,
  Segmented,
  Select,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));

const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;

export function PresupuestosScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [lista, setLista] = useState<PresupuestoDTO[] | null>(null);
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

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [hogares, presupuestos] = await Promise.all([
        api.get<HogarDTO[]>('/usuarios/me/hogares', token),
        api.get<PresupuestoDTO[]>('/presupuestos', token),
      ]);
      setHogarId(hogares[0]?.id ?? null);
      setLista(presupuestos);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

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
      setIngresos('');
      setGastos('');
      setAhorro('');
      setFechaInicio('');
      setFechaFin('');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  // HZ-19: numera las preguntas del formulario en el orden en que se muestran.
  const paso = contadorPasos();
  return (
    <Screen onRefresh={cargar}>
      <Ayuda>
        Un presupuesto fija cuánto esperas ingresar y gastar en un período y lo
        compara con lo real (en total y, si quieres, por rubro).
      </Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          titulo="Todavía no tienes presupuestos"
          descripcion="Crea uno abajo."
        />
      ) : (
        lista.map((p) => (
          <Card
            key={p.id}
            onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: p.id })}
          >
            <View style={styles.head}>
              <Text style={styles.nombre}>
                {etiqueta(p.tipo)} ·{' '}
                {p.periodicidad === 'PERIODICO' ? etiqueta(p.intervalo ?? '') : 'Específico'}
              </Text>
              <Text style={styles.estado}>
                {p.estado ? etiqueta(p.estado) : p.vigente ? 'Vigente' : 'Fuera de vigencia'}
              </Text>
            </View>
            <Text style={styles.muted}>
              {p.fechaInicio ?? '—'} → {p.fechaFin ?? '—'}
            </Text>
            <Text style={styles.muted}>
              Ingresos {money(p.ingresosEsperados ?? 0, p.moneda)} · Gastos{' '}
              {money(p.gastosEsperados ?? 0, p.moneda)}
            </Text>
          </Card>
        ))
      )}

      <Panel>
        <Text style={styles.nombre}>Nuevo presupuesto</Text>
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
        <Button
          title="Crear presupuesto"
          onPress={crear}
          loading={busy}
          disabled={tipo === 'FAMILIAR' && !hogarId}
        />
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: c.text },
  estado: { fontSize: 12, fontWeight: '600', color: c.muted },
  muted: tipoDe(c).nota,
});
