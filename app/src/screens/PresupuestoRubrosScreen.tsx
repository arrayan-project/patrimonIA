import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type HogarDTO,
  type ObjetivoFinancieroDTO,
  type PresupuestoDTO,
  type PresupuestoLineaAhorroDTO,
  type PresupuestoLineaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Skeleton, Button, ErrorText, MoneyField, Screen, Panel, useC, tipoDe, type Paleta } from '../ui';

/** Editor de las líneas del presupuesto por rubro (una por categoría del hogar). */
export function PresupuestoRubrosScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const presupuestoId = nav.route.params?.presupuestoId as string;

  const [cats, setCats] = useState<CategoriaMovimientoDTO[] | null>(null);
  // categoriaId → monto canónico ('' = sin línea)
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[]>([]);
  const [montosAhorro, setMontosAhorro] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const presu = await api.get<PresupuestoDTO>(`/presupuestos/${presupuestoId}`, token);
      let hogarId = presu.hogarId;
      if (!hogarId) {
        const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        hogarId = hogares[0]?.id ?? null;
      }
      const [lista, lineas, objs, lineasAhorro] = await Promise.all([
        hogarId
          ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hogarId}/categorias-movimiento`, token)
          : Promise.resolve<CategoriaMovimientoDTO[]>([]),
        api.get<PresupuestoLineaDTO[]>(`/presupuestos/${presupuestoId}/lineas`, token),
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token).catch(() => []),
        api
          .get<PresupuestoLineaAhorroDTO[]>(`/presupuestos/${presupuestoId}/lineas-ahorro`, token)
          .catch(() => []),
      ]);
      setCats(lista);
      const prev: Record<string, string> = {};
      for (const l of lineas) prev[l.categoriaId] = String(l.montoEsperado);
      setMontos(prev);
      setObjetivos(objs.filter((o) => o.estado === 'EN_PROGRESO'));
      const prevA: Record<string, string> = {};
      for (const l of lineasAhorro) prevA[l.objetivoId] = String(l.montoEsperado);
      setMontosAhorro(prevA);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [presupuestoId, token]);

  useCargaAlEnfocar(cargar);

  const guardar = async () => {
    setBusy(true);
    setError('');
    try {
      const lineas = Object.entries(montos)
        .map(([categoriaId, v]) => ({ categoriaId, montoEsperado: Number(v || '0') }))
        .filter((l) => l.montoEsperado > 0);
      await api.post('/comandos/DefinirLineasPresupuesto', { presupuestoId, lineas }, token);
      const lineasAhorro = Object.entries(montosAhorro)
        .map(([objetivoId, v]) => ({ objetivoId, montoEsperado: Number(v || '0') }))
        .filter((l) => l.montoEsperado > 0);
      await api.post(
        '/comandos/DefinirLineasAhorroPresupuesto',
        { presupuestoId, lineas: lineasAhorro },
        token,
      );
      toast.mostrar('Rubros guardados');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (cats === null) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const gastos = cats.filter((c) => c.tipoAplicable !== 'INGRESO');
  const ingresos = cats.filter((c) => c.tipoAplicable === 'INGRESO');
  const total = (arr: CategoriaMovimientoDTO[]) =>
    arr.reduce((s, c) => s + Number(montos[c.id] || '0'), 0);

  const grupo = (titulo: string, arr: CategoriaMovimientoDTO[], suma: number) =>
    arr.length === 0 ? null : (
      <Panel>
        <View style={styles.filaTitulo}>
          <Text style={styles.sectionTitle}>{titulo}</Text>
          <Text style={styles.muted}>{suma.toLocaleString('es-CL')}</Text>
        </View>
        {arr.map((c) => (
          <MoneyField
            key={c.id}
            label={c.nombre}
            value={montos[c.id] ?? ''}
            onChange={(v) => setMontos((m) => ({ ...m, [c.id]: v }))}
          />
        ))}
      </Panel>
    );

  return (
    <Screen
      onRefresh={cargar}
      pie={
        <Button
          title="Guardar rubros"
          onPress={guardar}
          loading={busy}
          disabled={cats.length === 0 && objetivos.length === 0}
        />
      }
    >
      <Text style={styles.muted}>Cuánto esperas por categoría en el período. Deja en blanco lo que no quieras seguir.</Text>

      {grupo('Gastos por rubro', gastos, total(gastos))}
      {grupo('Ingresos por rubro', ingresos, total(ingresos))}

      {objetivos.length > 0 && (
        <Panel>
          <View style={styles.filaTitulo}>
            <Text style={styles.sectionTitle}>Ahorro por meta</Text>
            <Text style={styles.muted}>
              {objetivos
                .reduce((s, o) => s + Number(montosAhorro[o.id] || '0'), 0)
                .toLocaleString('es-CL')}
            </Text>
          </View>
          <Text style={styles.muted}>
            Cuánto esperas ahorrar para cada meta en el período. El real usa lo
            ahorrado dentro del período.
          </Text>
          {objetivos.map((o) => (
            <MoneyField
              key={o.id}
              label={o.nombre}
              value={montosAhorro[o.id] ?? ''}
              onChange={(v) => setMontosAhorro((m) => ({ ...m, [o.id]: v }))}
            />
          ))}
        </Panel>
      )}

      {cats.length === 0 && (
        <Text style={styles.muted}>
          Este hogar no tiene categorías. Créalas en Ajustes → Categorías de movimiento.
        </Text>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: tipoDe(c).seccion,
  muted: tipoDe(c).nota,
});
