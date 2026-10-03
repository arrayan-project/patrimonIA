import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type PlantillaMovimientoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos } from '../opciones';
import {
  AccionDestructiva,
  Button,
  contadorPasos,
  Elegir,
  ErrorText,
  Field,
  MoneyField,
  Screen,
  Segmented,
  Skeleton,
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

/**
 * Formulario de una plantilla (plantillas de pantalla, R2): sin `plantillaId`
 * crea; con él edita y ofrece eliminar al final. Ya no vive bajo la lista.
 */
export function PlantillaFormScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const plantillaId = nav.route.params?.plantillaId as string | undefined;

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [b, setB] = useState<Borrador>(VACIO);
  const [actual, setActual] = useState<PlantillaMovimientoDTO | null>(null);

  useTitulo(plantillaId ? 'Editar plantilla' : 'Nueva plantilla');

  useEffect(() => {
    (async () => {
      try {
        const [pls, els, hogares] = await Promise.all([
          plantillaId
            ? api.get<PlantillaMovimientoDTO[]>('/usuarios/me/plantillas-movimiento', token)
            : Promise.resolve([]),
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
          api.get<HogarDTO[]>('/usuarios/me/hogares', token),
        ]);
        setElementos(els);
        setCategorias(
          hogares[0]
            ? await api.get<CategoriaMovimientoDTO[]>(`/hogares/${hogares[0].id}/categorias-movimiento`, token)
            : [],
        );
        const p = pls.find((x) => x.id === plantillaId);
        if (plantillaId && !p) return setError('La plantilla ya no existe.');
        if (p) {
          setActual(p);
          setB({
            nombre: p.nombre,
            tipo: p.tipo,
            monto: p.monto != null ? String(p.monto) : '',
            origenId: p.elementoOrigenId,
            destinoId: p.elementoDestinoId,
            categoriaId: p.categoriaId,
            glosa: p.glosa ?? '',
          });
        }
        setCargado(true);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Error inesperado');
      }
    })();
  }, [token, plantillaId]);

  const necesitaOrigen = b.tipo === 'GASTO' || b.tipo === 'TRANSFERENCIA';
  const necesitaDestino = b.tipo === 'INGRESO' || b.tipo === 'TRANSFERENCIA';
  const catAplicables = categorias.filter(
    (c) => c.tipoAplicable === 'AMBOS' || c.tipoAplicable === b.tipo,
  );
  const listo = !!b.nombre.trim();

  const guardar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      const campos = {
        nombre: b.nombre.trim(),
        tipo: b.tipo,
        monto: b.monto.trim() ? Number(b.monto) : null,
        elementoOrigenId: necesitaOrigen ? b.origenId : null,
        elementoDestinoId: necesitaDestino ? b.destinoId : null,
        categoriaId: b.tipo !== 'TRANSFERENCIA' ? b.categoriaId : null,
        glosa: b.glosa.trim() || null,
      };
      if (actual) {
        await api.post('/comandos/ActualizarPlantillaMovimiento', { plantillaId: actual.id, ...campos }, token);
        toast.mostrar('Plantilla guardada');
      } else {
        await api.post('/comandos/CrearPlantillaMovimiento', campos, token);
        toast.mostrar('Plantilla creada');
      }
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const borrar = async () => {
    if (!actual) return;
    if (!(await confirmar('Eliminar plantilla', `"${actual.nombre}" se borra. Los movimientos que ya registraste no cambian.`, 'Eliminar')))
      return;
    setBusy(true);
    try {
      await api.post('/comandos/EliminarPlantillaMovimiento', { plantillaId: actual.id }, token);
      toast.mostrar('Plantilla eliminada');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!cargado) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <Button
          title={actual ? 'Guardar plantilla' : 'Crear plantilla'}
          onPress={guardar}
          loading={busy}
          disabled={!listo}
        />
      }
    >
      <Field
        label="Nombre"
        paso={paso({ hecho: listo })}
        value={b.nombre}
        onChangeText={(nombre) => setB((x) => ({ ...x, nombre }))}
        autoCapitalize="sentences"
        placeholder="p. ej. Arriendo"
      />
      <Segmented
        label="Tipo"
        paso={paso({ hecho: true })}
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
      {actual ? <AccionDestructiva title="Eliminar plantilla" onPress={borrar} /> : null}
    </Screen>
  );
}
