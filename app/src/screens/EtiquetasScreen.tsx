import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type EtiquetaDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  Chip,
  EmptyState,
  ErrorText,
  Field,
  LinkButton,
  PALETA_CATEGORIA,
  Screen,
  Title,
  Skeleton,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

export function EtiquetasScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();

  const [lista, setLista] = useState<EtiquetaDTO[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setLista(await api.get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token));
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
        '/comandos/CrearEtiqueta',
        { nombre: nombre.trim(), ...(color ? { color } : {}) },
        token,
      );
      setNombre('');
      setColor(null);
    }, 'Etiqueta creada');

  const guardarEdicion = (id: string) =>
    run(async () => {
      await api.post(
        '/comandos/ActualizarEtiqueta',
        { etiquetaId: id, nombre: editNombre.trim() },
        token,
      );
      setEditId(null);
    }, 'Guardado');

  const borrar = async (e: EtiquetaDTO) => {
    if (!(await confirmar('Eliminar etiqueta', `"${e.nombre}" se quita de todos los movimientos que la tenían.`, 'Eliminar')))
      return;
    await run(() => api.post('/comandos/EliminarEtiqueta', { etiquetaId: e.id }, token), 'Etiqueta eliminada');
  };

  if (lista === null) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <Title>Etiquetas</Title>
      <Ayuda>
        Marcas personales y transversales para tus movimientos (#reembolsable,
        #viaje-2026). Un movimiento puede llevar varias. A diferencia de la
        categoría, no entran en el presupuesto.
      </Ayuda>

      {lista.map((e) => (
        <Panel key={e.id}>
          {editId === e.id ? (
            <>
              <Field label="Nombre" value={editNombre} onChangeText={setEditNombre} />
              <View style={styles.fila}>
                <Button title="Guardar" onPress={() => guardarEdicion(e.id)} loading={busy} />
                <LinkButton title="Cancelar" onPress={() => setEditId(null)} />
              </View>
            </>
          ) : (
            <View style={styles.fila}>
              <Chip label={e.nombre} color={e.color} activo />
              <View style={styles.filaBotones}>
                <LinkButton
                  title="Editar"
                  onPress={() => {
                    setEditId(e.id);
                    setEditNombre(e.nombre);
                  }}
                />
                <LinkButton title="Eliminar" onPress={() => borrar(e)} />
              </View>
            </View>
          )}
        </Panel>
      ))}

      <Panel>
        <Text style={styles.nombre}>Nueva etiqueta</Text>
        <Field
          label="Nombre"
          value={nombre}
          onChangeText={setNombre}
          placeholder="p. ej. reembolsable"
        />
        <Text style={styles.muted}>Color (opcional)</Text>
        <View style={styles.colores}>
          <Pressable onPress={() => setColor(null)}>
            <View style={[styles.swatch, !color && styles.swatchSel, { backgroundColor: c.faint }]} />
          </Pressable>
          {PALETA_CATEGORIA.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)}>
              <View style={[styles.swatch, color === c && styles.swatchSel, { backgroundColor: c }]} />
            </Pressable>
          ))}
        </View>
        <Button title="Crear etiqueta" onPress={crear} loading={busy} disabled={!nombre.trim()} />
      </Panel>

      {lista.length === 0 && (
        <EmptyState
          icon="pricetags-outline"
          titulo="Aún no tienes etiquetas"
          descripcion="Crea marcas como #reembolsable o #viaje-2026 para cortar tus movimientos de forma transversal."
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  filaBotones: { flexDirection: 'row', gap: 16 },
  nombre: { fontSize: 15, fontWeight: '700', color: c.text },
  muted: tipoDe(c).nota,
  colores: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  swatchSel: { borderColor: c.text },
});
