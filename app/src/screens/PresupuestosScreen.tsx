import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type PresupuestoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  Card,
  colors,
  DateField,
  EmptyState,
  ErrorText,
  etiqueta,
  LinkButton,
  MoneyField,
  Skeleton,
  Screen,
  Segmented,
  Title,
  tipo,
  Panel,
} from '../ui';

const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;

export function PresupuestosScreen() {
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

  return (
    <Screen onRefresh={cargar}>
      <Title>Presupuestos</Title>

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
              Ingresos {money(p.ingresosEsperados ?? 0, 'CLP')} · Gastos{' '}
              {money(p.gastosEsperados ?? 0, 'CLP')}
            </Text>
          </Card>
        ))
      )}

      <Panel>
        <Text style={styles.nombre}>Nuevo presupuesto</Text>
        <Segmented label="Tipo" options={['INDIVIDUAL', 'FAMILIAR'] as const} value={tipo} onChange={setTipo} />
        {tipo === 'FAMILIAR' && !hogarId && (
          <Text style={styles.muted}>Necesitas pertenecer a un hogar para un presupuesto familiar.</Text>
        )}
        <Segmented
          label="Periodicidad"
          options={['PERIODICO', 'ESPECIFICO'] as const}
          value={periodicidad}
          onChange={setPeriodicidad}
        />
        {periodicidad === 'PERIODICO' ? (
          <Segmented label="Intervalo" options={INTERVALOS} value={intervalo} onChange={setIntervalo} />
        ) : (
          <>
            <DateField label="Inicio (opcional)" value={fechaInicio} onChange={setFechaInicio} optional />
            <DateField label="Fin (opcional)" value={fechaFin} onChange={setFechaFin} optional />
          </>
        )}
        <MoneyField label="Ingresos esperados" value={ingresos} onChange={setIngresos} />
        <MoneyField label="Gastos esperados" value={gastos} onChange={setGastos} />
        <MoneyField label="Ahorro esperado" value={ahorro} onChange={setAhorro} />
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

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.text },
  estado: { fontSize: 12, fontWeight: '600', color: colors.muted },
  muted: tipo.nota,
});
