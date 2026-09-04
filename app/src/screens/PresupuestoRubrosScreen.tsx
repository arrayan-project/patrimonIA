import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type HogarDTO,
  type PresupuestoDTO,
  type PresupuestoLineaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Skeleton, Button, colors, ErrorText, LinkButton, MoneyField, Screen, Title } from '../ui';

/** Editor de las líneas del presupuesto por rubro (una por categoría del hogar). */
export function PresupuestoRubrosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const presupuestoId = nav.route.params?.presupuestoId as string;

  const [cats, setCats] = useState<CategoriaMovimientoDTO[] | null>(null);
  // categoriaId → monto canónico ('' = sin línea)
  const [montos, setMontos] = useState<Record<string, string>>({});
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
      const [lista, lineas] = await Promise.all([
        hogarId
          ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hogarId}/categorias-movimiento`, token)
          : Promise.resolve<CategoriaMovimientoDTO[]>([]),
        api.get<PresupuestoLineaDTO[]>(`/presupuestos/${presupuestoId}/lineas`, token),
      ]);
      setCats(lista);
      const prev: Record<string, string> = {};
      for (const l of lineas) prev[l.categoriaId] = String(l.montoEsperado);
      setMontos(prev);
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
      <View style={styles.card}>
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
      </View>
    );

  return (
    <Screen onRefresh={cargar}>
      <Title>Presupuesto por rubro</Title>
      <Text style={styles.muted}>
        Fija cuánto esperas gastar o ingresar por categoría dentro del período del
        presupuesto. Deja en blanco (o 0) los rubros que no quieras seguir.
      </Text>

      {grupo('Gastos por rubro', gastos, total(gastos))}
      {grupo('Ingresos por rubro', ingresos, total(ingresos))}

      {cats.length === 0 && (
        <Text style={styles.muted}>
          Este hogar no tiene categorías. Créalas en Ajustes → Categorías de movimiento.
        </Text>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Guardar rubros" onPress={guardar} loading={busy} disabled={cats.length === 0} />
      <LinkButton title="Cancelar" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 10 },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
});
