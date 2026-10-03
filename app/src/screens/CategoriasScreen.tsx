import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type CategoriaMovimientoDTO, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Ayuda, Button, ErrorText, etiqueta, Field, LinkButton, Screen, Segmented, Select, Skeleton, Panel, useC, type Paleta, tipoDe } from '../ui';

const TIPOS = ['GASTO', 'INGRESO', 'AMBOS'] as const;

export function CategoriasScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();

  const [hogarId, setHogarId] = useState<string | null>(null);
  const [lista, setLista] = useState<CategoriaMovimientoDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('GASTO');
  const [padre, setPadre] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPadre, setEditPadre] = useState('');

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

  // Raíces en su orden; cada una seguida de sus subcategorías.
  const raices = (lista ?? []).filter((x) => !x.categoriaPadreId);
  const hijosDe = (id: string) => (lista ?? []).filter((x) => x.categoriaPadreId === id);
  const ordenadas: { cat: CategoriaMovimientoDTO; nivel: 0 | 1; iRaiz: number }[] = [];
  raices.forEach((r, iRaiz) => {
    ordenadas.push({ cat: r, nivel: 0, iRaiz });
    hijosDe(r.id).forEach((h) => ordenadas.push({ cat: h, nivel: 1, iRaiz }));
  });
  const opcPadre = [
    { value: '', label: 'Ninguna (categoría raíz)' },
    ...raices.map((r) => ({ value: r.id, label: r.nombre })),
  ];

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
        {
          hogarId,
          nombre: nombre.trim(),
          tipoAplicable: tipo,
          ...(padre ? { categoriaPadreId: padre } : {}),
        },
        token,
      );
      setNombre('');
      setPadre('');
    }, 'Categoría creada');

  const guardarEdicion = (cat: CategoriaMovimientoDTO) =>
    run(async () => {
      const body: Record<string, unknown> = { categoriaId: cat.id };
      if (editNombre.trim() !== cat.nombre) body.nombre = editNombre.trim();
      if (editPadre !== (cat.categoriaPadreId ?? '')) body.categoriaPadreId = editPadre || null;
      await api.post('/comandos/ActualizarCategoriaMovimiento', body, token);
      setEditId(null);
    }, 'Guardado');

  const archivar = async (cat: CategoriaMovimientoDTO) => {
    if (!(await confirmar('Archivar categoría', `"${cat.nombre}" deja de aparecer al registrar movimientos. Los movimientos ya clasificados no cambian.`, 'Archivar')))
      return;
    await run(
      () => api.post('/comandos/ArchivarCategoriaMovimiento', { categoriaId: cat.id }, token),
      'Categoría archivada',
    );
  };

  const mover = (iRaiz: number, delta: number) => {
    const j = iRaiz + delta;
    if (j < 0 || j >= raices.length) return;
    const orden = [...raices];
    [orden[iRaiz], orden[j]] = [orden[j], orden[iRaiz]];
    // orden espera TODAS las categorías del hogar — raíces reordenadas + sus hijos.
    const ids = orden.flatMap((r) => [r.id, ...hijosDe(r.id).map((h) => h.id)]);
    void run(() =>
      api.post('/comandos/ReordenarCategoriasMovimiento', { hogarId, orden: ids }, token),
    );
  };

  return (
    <Screen onRefresh={cargar}>
      <Ayuda>
        Vocabulario del hogar para clasificar ingresos y gastos (Mercado,
        Servicios, Sueldo…). Puedes anidarlas en dos niveles ("Servicios ›
        Internet"). La lista y el orden los ven todos los miembros.
      </Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : (
        ordenadas.map(({ cat, nivel, iRaiz }) => (
          <Panel key={cat.id} style={nivel === 1 ? styles.hijo : undefined}>
            {editId === cat.id ? (
              <>
                <Field label="Nombre" value={editNombre} onChangeText={setEditNombre} autoCapitalize="sentences" />
                <Select
                  label="Categoría padre"
                  options={opcPadre.filter((o) => o.value !== cat.id)}
                  value={editPadre}
                  onChange={setEditPadre}
                />
                <View style={styles.fila}>
                  <Button title="Guardar" onPress={() => guardarEdicion(cat)} loading={busy} />
                  <LinkButton title="Cancelar" onPress={() => setEditId(null)} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre}>
                      {nivel === 1 ? '› ' : ''}
                      {cat.nombre}
                    </Text>
                    <Text style={styles.muted}>{etiqueta(cat.tipoAplicable)}</Text>
                  </View>
                  {nivel === 0 && (
                    <View style={styles.filaBotones}>
                      <Pressable hitSlop={8} onPress={() => mover(iRaiz, -1)} accessibilityRole="button" accessibilityLabel="Subir">
                        <Text style={styles.flecha}>▲</Text>
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => mover(iRaiz, 1)} accessibilityRole="button" accessibilityLabel="Bajar">
                        <Text style={styles.flecha}>▼</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View style={styles.fila}>
                  <LinkButton
                    title="Editar"
                    onPress={() => {
                      setEditId(cat.id);
                      setEditNombre(cat.nombre);
                      setEditPadre(cat.categoriaPadreId ?? '');
                    }}
                  />
                  <LinkButton title="Archivar" onPress={() => archivar(cat)} />
                </View>
              </>
            )}
          </Panel>
        ))
      )}

      <Panel>
        <Text style={styles.nombre}>Nueva categoría</Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" placeholder="p. ej. Mascotas" />
        <Segmented label="Aplica a" options={TIPOS} value={tipo} onChange={setTipo} />
        <Select label="Categoría padre" options={opcPadre} value={padre} onChange={setPadre} />
        <Button title="Crear categoría" onPress={crear} loading={busy} disabled={!nombre.trim() || !hogarId} />
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  filaBotones: { flexDirection: 'row', gap: 16 },
  flecha: { fontSize: 16, color: c.primary },
  nombre: { fontSize: 15, fontWeight: '700', color: c.text },
  muted: tipoDe(c).nota,
  hijo: { marginLeft: 20 },
});
