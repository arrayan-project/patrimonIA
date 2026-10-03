import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type PlantillaMovimientoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos } from '../opciones';
import {
  Elegir,
  contadorPasos,
  Ayuda,
  Button,
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  LinkButton,
  MoneyField,
  Screen,
  Segmented,
  Title,
  Skeleton,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

const TIPOS = ['GASTO', 'INGRESO', 'TRANSFERENCIA'] as const;
type Tipo = (typeof TIPOS)[number];

interface Borrador {
  nombre: string;
  tipo: Tipo;
  monto: string;
  origenId: string | null;
  destinoId: string | null;
  categoriaId: string | null;
  glosa: string;
}

const VACIO: Borrador = {
  nombre: '',
  tipo: 'GASTO',
  monto: '',
  origenId: null,
  destinoId: null,
  categoriaId: null,
  glosa: '',
};

export function PlantillasScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();

  const [lista, setLista] = useState<PlantillaMovimientoDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intento, setIntento] = useState(false);

  // null = formulario oculto · 'nueva' = crear · id = editar esa plantilla
  const [modo, setModo] = useState<null | 'nueva' | string>(null);
  const [b, setB] = useState<Borrador>(VACIO);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [pls, els, hogares] = await Promise.all([
        api.get<PlantillaMovimientoDTO[]>('/usuarios/me/plantillas-movimiento', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
        api.get<HogarDTO[]>('/usuarios/me/hogares', token),
      ]);
      setLista(pls);
      setElementos(els);
      setCategorias(
        hogares[0]
          ? await api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hogares[0].id}/categorias-movimiento`,
              token,
            )
          : [],
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const abrirEdicion = (p: PlantillaMovimientoDTO) => {
    setB({
      nombre: p.nombre,
      tipo: p.tipo,
      monto: p.monto != null ? String(p.monto) : '',
      origenId: p.elementoOrigenId,
      destinoId: p.elementoDestinoId,
      categoriaId: p.categoriaId,
      glosa: p.glosa ?? '',
    });
    setIntento(false);
    setModo(p.id);
  };

  const errNombre = b.nombre.trim() ? '' : 'Ponle un nombre a la plantilla.';

  const guardar = async () => {
    setIntento(true);
    if (errNombre) return;
    setBusy(true);
    setError('');
    const necesitaOrigen = b.tipo === 'GASTO' || b.tipo === 'TRANSFERENCIA';
    const necesitaDestino = b.tipo === 'INGRESO' || b.tipo === 'TRANSFERENCIA';
    const puedeCategoria = b.tipo !== 'TRANSFERENCIA';
    try {
      const campos = {
        nombre: b.nombre.trim(),
        tipo: b.tipo,
        monto: b.monto.trim() ? Number(b.monto) : null,
        elementoOrigenId: necesitaOrigen ? b.origenId : null,
        elementoDestinoId: necesitaDestino ? b.destinoId : null,
        categoriaId: puedeCategoria ? b.categoriaId : null,
        glosa: b.glosa.trim() || null,
      };
      if (modo === 'nueva') {
        await api.post('/comandos/CrearPlantillaMovimiento', campos, token);
        toast.mostrar('Plantilla creada');
      } else {
        await api.post(
          '/comandos/ActualizarPlantillaMovimiento',
          { plantillaId: modo, ...campos },
          token,
        );
        toast.mostrar('Plantilla guardada');
      }
      setModo(null);
      setB(VACIO);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (p: PlantillaMovimientoDTO) => {
    if (!(await confirmar('Eliminar plantilla', `"${p.nombre}" se borra. Los movimientos que ya registraste no cambian.`, 'Eliminar')))
      return;
    setBusy(true);
    try {
      await api.post('/comandos/EliminarPlantillaMovimiento', { plantillaId: p.id }, token);
      toast.mostrar('Plantilla eliminada');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (lista === null) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const nombreEl = (id: string | null) =>
    id ? (elementos.find((e) => e.id === id)?.nombre ?? '—') : null;
  const nombreCat = (id: string | null) =>
    id ? (categorias.find((c) => c.id === id)?.nombre ?? '—') : null;

  const necesitaOrigen = b.tipo === 'GASTO' || b.tipo === 'TRANSFERENCIA';
  const necesitaDestino = b.tipo === 'INGRESO' || b.tipo === 'TRANSFERENCIA';
  const catAplicables = categorias.filter(
    (c) => c.tipoAplicable === 'AMBOS' || c.tipoAplicable === b.tipo,
  );

  // HZ-19: numera las preguntas del formulario en el orden en que se muestran.
  const paso = contadorPasos();
  return (
    <Screen onRefresh={cargar}>
      <Title>Plantillas de movimiento</Title>
      <Ayuda>
        Moldes para registrar el gasto o ingreso de siempre en dos toques.
        Aparecen arriba en "Registrar movimiento". A diferencia de un movimiento
        programado, una plantilla no tiene fecha.
      </Ayuda>

      {modo === null &&
        lista.map((p) => (
          <Panel key={p.id}>
            <View style={styles.fila}>
              <Text style={styles.nombre}>{p.nombre}</Text>
              <Text style={styles.muted}>{etiqueta(p.tipo)}</Text>
            </View>
            <Text style={styles.muted}>
              {[
                p.monto != null ? money(p.monto, p.moneda ?? 'CLP') : null,
                nombreEl(p.elementoOrigenId) && `desde ${nombreEl(p.elementoOrigenId)}`,
                nombreEl(p.elementoDestinoId) && `a ${nombreEl(p.elementoDestinoId)}`,
                nombreCat(p.categoriaId),
                p.glosa,
              ]
                .filter(Boolean)
                .join(' · ') || 'Molde en blanco'}
            </Text>
            <View style={styles.fila}>
              <LinkButton title="Editar" onPress={() => abrirEdicion(p)} />
              <LinkButton title="Eliminar" onPress={() => borrar(p)} />
            </View>
          </Panel>
        ))}

      {modo === null && (
        <Button
          title="Nueva plantilla"
          onPress={() => {
            setB(VACIO);
            setIntento(false);
            setModo('nueva');
          }}
        />
      )}

      {modo !== null && (
        <Panel>
          <Text style={styles.nombre}>{modo === 'nueva' ? 'Nueva plantilla' : 'Editar plantilla'}</Text>
          <Field
            label="Nombre"
            paso={paso()}
            value={b.nombre}
            onChangeText={(nombre) => setB((x) => ({ ...x, nombre }))}
            autoCapitalize="sentences"
            placeholder="p. ej. Arriendo"
            error={intento ? errNombre : undefined}
          />
          <Segmented
            label="Tipo"
            paso={paso()}
            options={TIPOS}
            value={b.tipo}
            onChange={(tipo) => setB((x) => ({ ...x, tipo }))}
          />
          <MoneyField
            label="Monto (opcional)"
            paso={paso()}
            value={b.monto}
            onChange={(monto) => setB((x) => ({ ...x, monto }))}
          />

          {necesitaOrigen && (
            <Elegir
              label="Desde qué cuenta (opcional)"
              paso={paso()}
              opcionNula="Sin definir"
              value={b.origenId}
              options={opcionesDeElementos(elementos, { saldo: false })}
              onChange={(origenId) =>
                setB((x) => ({ ...x, origenId, destinoId: x.destinoId === origenId ? null : x.destinoId }))
              }
            />
          )}

          {necesitaDestino && (
            <Elegir
              label="A qué cuenta (opcional)"
              paso={paso()}
              opcionNula="Sin definir"
              value={b.destinoId}
              options={opcionesDeElementos(elementos, { saldo: false, excluir: b.origenId })}
              onChange={(destinoId) => setB((x) => ({ ...x, destinoId }))}
            />
          )}

          {b.tipo !== 'TRANSFERENCIA' && catAplicables.length > 0 && (
            <Elegir
              label="Categoría (opcional)"
              paso={paso()}
              opcionNula="Sin categoría"
              value={b.categoriaId}
              options={catAplicables.map((c) => ({ value: c.id, label: c.nombre }))}
              onChange={(categoriaId) => setB((x) => ({ ...x, categoriaId }))}
            />
          )}

          <Field
            label="Detalle (opcional)"
            paso={paso()}
            value={b.glosa}
            onChangeText={(glosa) => setB((x) => ({ ...x, glosa }))}
            autoCapitalize="sentences"
            maxLength={140}
          />

          <ErrorText>{error}</ErrorText>
          <Button title="Guardar" onPress={guardar} loading={busy} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === null && lista.length === 0 && (
        <EmptyState
          icon="copy-outline"
          titulo="Aún no tienes plantillas"
          descripcion="Guarda el gasto o ingreso de siempre como molde y regístralo después en dos toques."
        />
      )}
      {modo === null && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: c.text },
  nombre: { fontSize: 15, fontWeight: '700', color: c.text },
  muted: tipoDe(c).nota,
});
