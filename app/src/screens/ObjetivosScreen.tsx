import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type ObjetivoFinancieroDTO } from '../api/client';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  Card,
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  MoneyField,
  ProgressBar,
  Segmented,
  Select,
  Skeleton,
  Screen,
  Title,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

export function ObjetivosScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [compartir, setCompartir] = useState<'No' | 'Sí'>('No');
  const [moneda, setMoneda] = useState('CLP');
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [objs, hs] = await Promise.all([
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
        api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []),
      ]);
      setObjetivos(objs);
      setHogarId(hs[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const crear = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearObjetivoFinanciero',
        {
          nombre: nombre.trim(),
          montoObjetivo: Number(monto),
          ...(moneda !== 'CLP' ? { moneda: moneda.trim().toUpperCase() } : {}),
          ...(compartir === 'Sí' && hogarId ? { hogarId } : {}),
        },
        token,
      );
      toast.mostrar('Objetivo creado');
      setNombre('');
      setMonto('');
      setMoneda('CLP');
      setCompartir('No');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Objetivos financieros</Title>

      <Ayuda>
        Un objetivo es una meta de ahorro (el pie de una vivienda, un viaje).
        Adentro creas asignaciones y les guardas reservas de dinero para ir
        viendo el avance.
      </Ayuda>

      {objetivos === null ? (
        <Skeleton />
      ) : objetivos.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          titulo="Aún no tienes objetivos"
          descripcion="Créalo abajo y luego asígnale reservas."
        />
      ) : (
        (() => {
          const enProgreso = objetivos.filter((o) => o.estado === 'EN_PROGRESO');
          const monedas = new Set(enProgreso.map((o) => o.moneda));
          const meta = enProgreso.reduce((s, o) => s + o.montoObjetivo, 0);
          const avance = enProgreso.reduce((s, o) => s + o.progreso, 0);
          const pct = meta > 0 ? Math.round((avance / meta) * 100) : 0;
          return enProgreso.length > 1 && monedas.size === 1 ? (
            <Panel>
              <Text style={styles.nombre}>Avance total ({enProgreso.length} objetivos activos)</Text>
              <ProgressBar pct={pct} />
              <Text style={styles.muted}>
                {money(avance, [...monedas][0])} de {money(meta, [...monedas][0])} · {pct}%
              </Text>
            </Panel>
          ) : null;
        })()
      )}

      {objetivos !== null &&
        objetivos.length > 0 &&
        objetivos.map((o) => (
          <Card key={o.id} onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}>
            <View style={styles.head}>
              <Text style={styles.nombre}>{o.nombre}</Text>
              <Text style={styles.estado}>
                {o.hogarId ? '· del hogar · ' : ''}
                {etiqueta(o.estado)}
              </Text>
            </View>
            <ProgressBar pct={o.progresoPorcentaje} />
            <Text style={styles.muted}>
              {money(o.progreso, o.moneda)} de {money(o.montoObjetivo, o.moneda)} · {o.progresoPorcentaje}%
            </Text>
          </Card>
        ))}

      <Panel>
        <Text style={styles.nombre}>Nuevo objetivo</Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" placeholder="Pie vivienda" />
        <MoneyField label="Monto objetivo" value={monto} onChange={setMonto} moneda={moneda} />
        <Select label="Moneda" options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
        {hogarId && (
          <Segmented
            label="¿Compartir con el hogar?"
            options={['No', 'Sí'] as const}
            value={compartir}
            onChange={setCompartir}
            formatearOpcion={(v) => v}
          />
        )}
        {compartir === 'Sí' && (
          <Text style={styles.muted}>
            Todos los miembros lo verán. Podrás designar quiénes pueden modificarlo.
          </Text>
        )}
        <Button title="Crear objetivo" onPress={crear} loading={busy} disabled={!nombre.trim() || !(Number(monto) > 0)} />
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
