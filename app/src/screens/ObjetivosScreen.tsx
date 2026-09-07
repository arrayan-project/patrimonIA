import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
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
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  GoalCard,
  MoneyField,
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
  const [intento, setIntento] = useState(false);

  const errNombre = nombre.trim() ? '' : 'Ponle un nombre al objetivo.';
  const errMonto = Number(monto) > 0 ? '' : 'La meta debe ser mayor a 0.';

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
    setIntento(true);
    if (errNombre || errMonto) return;
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
            <GoalCard
              name={`Avance total · ${enProgreso.length} objetivos activos`}
              hint={`${pct}%`}
              pct={pct}
              footLeft={`${money(avance, [...monedas][0])} / ${money(meta, [...monedas][0])}`}
            />
          ) : null;
        })()
      )}

      {objetivos !== null &&
        objetivos.length > 0 &&
        objetivos.map((o) => (
          <GoalCard
            key={o.id}
            name={o.hogarId ? `${o.nombre} · hogar` : o.nombre}
            hint={etiqueta(o.estado)}
            pct={o.progresoPorcentaje}
            ok={o.estado === 'COMPLETADO' || o.progresoPorcentaje >= 100}
            footLeft={`${money(o.progreso, o.moneda)} / ${money(o.montoObjetivo, o.moneda)}`}
            footRight={`${o.progresoPorcentaje}%`}
            onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
          />
        ))}

      <Panel>
        <Text style={styles.nombre}>Nuevo objetivo</Text>
        <Field
          label="Nombre"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="sentences"
          placeholder="Pie vivienda"
          error={intento ? errNombre : undefined}
        />
        <MoneyField
          label="Monto objetivo"
          value={monto}
          onChange={setMonto}
          moneda={moneda}
          error={intento ? errMonto : undefined}
        />
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
        <Button title="Crear objetivo" onPress={crear} loading={busy} />
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  nombre: { fontSize: 16, fontWeight: '700', color: c.text },
  muted: tipoDe(c).nota,
});
