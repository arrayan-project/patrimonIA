import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, type HogarDTO, type PresupuestoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Button, colors, ErrorText, Field, LinkButton, Screen, Segmented, Title } from '../ui';

const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;

export function PresupuestosScreen() {
  const { token } = useSession();
  const nav = useNav();
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

  useEffect(() => {
    void cargar();
  }, [cargar]);

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
    <Screen>
      <Title>Presupuestos</Title>

      {lista === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : lista.length === 0 ? (
        <Text style={styles.muted}>Todavía no tienes presupuestos.</Text>
      ) : (
        lista.map((p) => (
          <Pressable
            key={p.id}
            style={styles.card}
            onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: p.id })}
          >
            <View style={styles.head}>
              <Text style={styles.nombre}>
                {p.tipo} · {p.periodicidad === 'PERIODICO' ? p.intervalo : 'específico'}
              </Text>
              <Text style={styles.estado}>
                {p.estado ?? (p.vigente ? 'vigente' : 'fuera de vigencia')}
              </Text>
            </View>
            <Text style={styles.muted}>
              {p.fechaInicio ?? '—'} → {p.fechaFin ?? '—'}
            </Text>
            <Text style={styles.muted}>
              Ingresos {money(p.ingresosEsperados ?? 0, 'CLP')} · Gastos{' '}
              {money(p.gastosEsperados ?? 0, 'CLP')}
            </Text>
          </Pressable>
        ))
      )}

      <View style={styles.card}>
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
            <Field label="Inicio (YYYY-MM-DD, opcional)" value={fechaInicio} onChangeText={setFechaInicio} placeholder="2026-01-01" />
            <Field label="Fin (YYYY-MM-DD, opcional)" value={fechaFin} onChangeText={setFechaFin} placeholder="2026-12-31" />
          </>
        )}
        <Field label="Ingresos esperados" keyboardType="numeric" value={ingresos} onChangeText={setIngresos} placeholder="0" />
        <Field label="Gastos esperados" keyboardType="numeric" value={gastos} onChangeText={setGastos} placeholder="0" />
        <Field label="Ahorro esperado" keyboardType="numeric" value={ahorro} onChangeText={setAhorro} placeholder="0" />
        <Button
          title="Crear presupuesto"
          onPress={crear}
          loading={busy}
          disabled={tipo === 'FAMILIAR' && !hogarId}
        />
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Actualizar" onPress={() => void cargar()} />
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.text },
  estado: { fontSize: 12, fontWeight: '600', color: colors.muted },
  muted: { fontSize: 13, color: colors.muted },
});
