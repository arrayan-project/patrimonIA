import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AgrupacionDTO,
  type ElementoPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Skeleton, Ayuda, Button, colors, EmptyState, ErrorText, Field, LinkButton, Screen, SelectRow, Title, tipo, Panel } from '../ui';

export function AgrupacionesScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();

  const [lista, setLista] = useState<AgrupacionDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState('');
  const [editId, setEditId] = useState<string | null>(null); // gestión de elementos de esa agrupación
  const [sel, setSel] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [ags, els] = await Promise.all([
        api.get<AgrupacionDTO[]>('/usuarios/me/agrupaciones', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      setLista(ags);
      setElementos(els);
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
      await api.post('/comandos/CrearAgrupacion', { nombre: nombre.trim() }, token);
      setNombre('');
    }, 'Agrupación creada');

  const borrar = async (a: AgrupacionDTO) => {
    if (!(await confirmar('Eliminar agrupación', `"${a.nombre}" se borra. Sus elementos quedan sin agrupar (no se pierde nada).`, 'Eliminar')))
      return;
    await run(() => api.post('/comandos/EliminarAgrupacion', { agrupacionId: a.id }, token), 'Agrupación eliminada');
  };

  const guardarElementos = (id: string) =>
    run(async () => {
      await api.post(
        '/comandos/DefinirElementosAgrupacion',
        { agrupacionId: id, elementoIds: sel },
        token,
      );
      setEditId(null);
    }, 'Elementos actualizados');

  if (lista === null) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const agrupacionDe = (elementoId: string) =>
    lista.find((a) => a.elementoIds.includes(elementoId));

  return (
    <Screen onRefresh={cargar}>
      <Title>Agrupaciones de elementos</Title>
      <Ayuda>
        Carpetas para ordenar tus cuentas y activos en el Inicio (p. ej.
        "Inversiones" con tu APV y fondos). No afectan tu patrimonio ni la
        consolidación — solo la vista.
      </Ayuda>

      {lista.map((a) => (
        <Panel key={a.id}>
          {editId === a.id ? (
            <>
              <Text style={styles.nombre}>Elementos de "{a.nombre}"</Text>
              {elementos.map((el) => {
                const otra = agrupacionDe(el.id);
                const enOtra = otra && otra.id !== a.id;
                return (
                  <SelectRow
                    key={el.id}
                    label={`${el.nombre}${enOtra ? ` · en "${otra!.nombre}"` : ''}`}
                    selected={sel.includes(el.id)}
                    onPress={() =>
                      setSel((xs) => (xs.includes(el.id) ? xs.filter((x) => x !== el.id) : [...xs, el.id]))
                    }
                  />
                );
              })}
              <Button title="Guardar" onPress={() => guardarElementos(a.id)} loading={busy} />
              <LinkButton title="Cancelar" onPress={() => setEditId(null)} />
            </>
          ) : (
            <>
              <View style={styles.fila}>
                <Text style={styles.nombre}>{a.nombre}</Text>
                <Text style={styles.muted}>{a.elementoIds.length} elemento(s)</Text>
              </View>
              {a.elementoIds.map((id) => {
                const el = elementos.find((e) => e.id === id);
                return el ? (
                  <Text key={id} style={styles.item}>
                    · {el.nombre} — {money(el.valorVigente, el.moneda)}
                  </Text>
                ) : null;
              })}
              <View style={styles.fila}>
                <LinkButton
                  title="Elegir elementos"
                  onPress={() => {
                    setSel(a.elementoIds);
                    setEditId(a.id);
                  }}
                />
                <LinkButton title="Eliminar" onPress={() => borrar(a)} />
              </View>
            </>
          )}
        </Panel>
      ))}

      <Panel>
        <Text style={styles.nombre}>Nueva agrupación</Text>
        <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="p. ej. Inversiones" />
        <Button title="Crear agrupación" onPress={crear} loading={busy} disabled={!nombre.trim()} />
      </Panel>

      {lista.length === 0 && (
        <EmptyState
          icon="folder-outline"
          titulo="Aún no tienes agrupaciones"
          descripcion="Crea carpetas como “Inversiones” para ordenar tus cuentas y activos en el Inicio."
        />
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  nombre: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: tipo.nota,
  item: { fontSize: 13, color: colors.text },
});
