import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type TipoElementoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { etiqueta } from '../labels';
import { Ayuda, Button, ErrorText, Field, LinkButton, Screen, Select, Skeleton, Title, Panel, useC, type Paleta, tipoDe } from '../ui';

const OPC_CAT = [
  { value: '', label: 'Sin sugerencia' },
  ...(['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const).map((v) => ({
    value: v,
    label: etiqueta(v),
  })),
];

export function TiposElementoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const toast = useToast();

  const [hogarId, setHogarId] = useState<string | null>(null);
  const [lista, setLista] = useState<TipoElementoDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState('');
  const [cat, setCat] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editCat, setEditCat] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      const h = hogares[0]?.id ?? null;
      setHogarId(h);
      setLista(h ? await api.get<TipoElementoDTO[]>(`/hogares/${h}/tipos-elemento`, token) : []);
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
        '/comandos/CrearTipoElemento',
        { hogarId, nombre: nombre.trim(), ...(cat ? { categoriaSugerida: cat } : {}) },
        token,
      );
      setNombre('');
      setCat('');
    }, 'Tipo creado');

  const guardarEdicion = (t: TipoElementoDTO) =>
    run(async () => {
      const body: Record<string, unknown> = { tipoId: t.id };
      if (editNombre.trim() !== t.nombre) body.nombre = editNombre.trim();
      if (editCat !== (t.categoriaSugerida ?? '')) body.categoriaSugerida = editCat || null;
      await api.post('/comandos/ActualizarTipoElemento', body, token);
      setEditId(null);
    }, 'Guardado');

  const archivar = async (t: TipoElementoDTO) => {
    if (!(await confirmar('Archivar tipo', `"${t.nombre}" deja de sugerirse al agregar cuentas o bienes. Los elementos ya creados no cambian.`, 'Archivar')))
      return;
    await run(() => api.post('/comandos/ArchivarTipoElemento', { tipoId: t.id }, token), 'Tipo archivado');
  };

  const mover = (i: number, delta: number) => {
    if (!lista) return;
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const orden = lista.map((t) => t.id);
    [orden[i], orden[j]] = [orden[j], orden[i]];
    void run(() => api.post('/comandos/ReordenarTiposElemento', { hogarId, orden }, token));
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Tipos de elemento patrimonial</Title>
      <Ayuda>
        Vocabulario del hogar para clasificar cuentas y bienes (cuenta corriente,
        APV, propiedad…). Al elegir un tipo al agregar un elemento se prellenar su
        categoría. Todos los miembros ven la lista.
      </Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : (
        lista.map((t, i) => (
          <Panel key={t.id}>
            {editId === t.id ? (
              <>
                <Field label="Nombre" value={editNombre} onChangeText={setEditNombre} autoCapitalize="sentences" />
                <Select label="Categoría sugerida" options={OPC_CAT} value={editCat} onChange={setEditCat} />
                <View style={styles.fila}>
                  <Button title="Guardar" onPress={() => guardarEdicion(t)} loading={busy} />
                  <LinkButton title="Cancelar" onPress={() => setEditId(null)} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.fila}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre}>{t.nombre}</Text>
                    <Text style={styles.muted}>
                      {t.categoriaSugerida ? etiqueta(t.categoriaSugerida) : 'Sin sugerencia'}
                    </Text>
                  </View>
                  <View style={styles.filaBotones}>
                    <Pressable hitSlop={8} onPress={() => mover(i, -1)} accessibilityRole="button" accessibilityLabel="Subir">
                      <Text style={styles.flecha}>▲</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => mover(i, 1)} accessibilityRole="button" accessibilityLabel="Bajar">
                      <Text style={styles.flecha}>▼</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.fila}>
                  <LinkButton
                    title="Editar"
                    onPress={() => {
                      setEditId(t.id);
                      setEditNombre(t.nombre);
                      setEditCat(t.categoriaSugerida ?? '');
                    }}
                  />
                  <LinkButton title="Archivar" onPress={() => archivar(t)} />
                </View>
              </>
            )}
          </Panel>
        ))
      )}

      <Panel>
        <Text style={styles.nombre}>Nuevo tipo</Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" placeholder="p. ej. Billetera digital" />
        <Select label="Categoría sugerida" options={OPC_CAT} value={cat} onChange={setCat} />
        <Button title="Crear tipo" onPress={crear} loading={busy} disabled={!nombre.trim() || !hogarId} />
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
});
