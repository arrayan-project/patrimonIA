import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type CategoriaMovimientoDTO, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Button, colors, ErrorText, etiqueta, Field, LinkButton, Screen, Segmented, Title } from '../ui';

const TIPOS = ['GASTO', 'INGRESO', 'AMBOS'] as const;

export function CategoriasScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();

  const [hogarId, setHogarId] = useState<string | null>(null);
  const [lista, setLista] = useState<CategoriaMovimientoDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('GASTO');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      const h = hogares[0]?.id ?? null;
      setHogarId(h);
      setLista(
        h ? await api.get<CategoriaMovimientoDTO[]>(`/hogares/${h}/categorias-movimiento`, token) : [],
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const run = async (fn: () => Promise<unknown>, aviso?: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (aviso) toast.mostrar(aviso);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const crear = () =>
    run(async () => {
      await api.post(
        '/comandos/CrearCategoriaMovimiento',
        { hogarId, nombre: nombre.trim(), tipoAplicable: tipo },
        token,
      );
      setNombre('');
    }, 'Categoría creada');

  const guardarEdicion = (id: string) =>
    run(async () => {
      await api.post(
        '/comandos/ActualizarCategoriaMovimiento',
        { categoriaId: id, nombre: editNombre.trim() },
        token,
      );
      setEditId(null);
    }, 'Guardado');

  const archivar = async (c: CategoriaMovimientoDTO) => {
    if (!(await confirmar('Archivar categoría', `"${c.nombre}" deja de aparecer al registrar movimientos. Los movimientos ya clasificados no cambian.`, 'Archivar')))
      return;
    await run(
      () => api.post('/comandos/ArchivarCategoriaMovimiento', { categoriaId: c.id }, token),
      'Categoría archivada',
    );
  };

  const mover = (i: number, delta: number) => {
    if (!lista) return;
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const orden = lista.map((c) => c.id);
    [orden[i], orden[j]] = [orden[j], orden[i]];
    void run(() =>
      api.post('/comandos/ReordenarCategoriasMovimiento', { hogarId, orden }, token),
    );
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Categorías de movimiento</Title>
      <Text style={styles.muted}>
        Vocabulario del hogar para clasificar ingresos y gastos. La lista y el orden
        los ven todos los miembros.
      </Text>

      {lista === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        lista.map((c, i) => (
          <View key={c.id} style={styles.card}>
            {editId === c.id ? (
              <>
                <Field label="Nombre" value={editNombre} onChangeText={setEditNombre} autoCapitalize="sentences" />
                <View style={styles.fila}>
                  <Button title="Guardar" onPress={() => guardarEdicion(c.id)} loading={busy} />
                  <LinkButton title="Cancelar" onPress={() => setEditId(null)} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fila}>
                  <View>
                    <Text style={styles.nombre}>{c.nombre}</Text>
                    <Text style={styles.muted}>{etiqueta(c.tipoAplicable)}</Text>
                  </View>
                  <View style={styles.filaBotones}>
                    <Pressable hitSlop={8} onPress={() => mover(i, -1)}>
                      <Text style={styles.flecha}>▲</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => mover(i, 1)}>
                      <Text style={styles.flecha}>▼</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.fila}>
                  <LinkButton
                    title="Editar"
                    onPress={() => {
                      setEditId(c.id);
                      setEditNombre(c.nombre);
                    }}
                  />
                  <LinkButton title="Archivar" onPress={() => archivar(c)} />
                </View>
              </>
            )}
          </View>
        ))
      )}

      <View style={styles.card}>
        <Text style={styles.nombre}>Nueva categoría</Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" placeholder="p. ej. Mascotas" />
        <Segmented label="Aplica a" options={TIPOS} value={tipo} onChange={setTipo} />
        <Button title="Crear categoría" onPress={crear} loading={busy} disabled={!nombre.trim() || !hogarId} />
      </View>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  filaBotones: { flexDirection: 'row', gap: 16 },
  flecha: { fontSize: 16, color: colors.primary },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
});
