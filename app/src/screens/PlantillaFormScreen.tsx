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
import { emojiCategoria } from '../emojis';
import { useNav, useTitulo } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos, opcionesDeMiembros } from '../opciones';
import {
  AccionDestructiva,
  AmountInput,
  Button,
  contadorPasos,
  Elegir,
  ErrorText,
  Field,
  Nota,
  Opcional,
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
 * Formulario de una plantilla (plantillas de pantalla, R2 y R3): sin
 * `plantillaId` crea; con él edita y ofrece eliminar al final. Con `desde`
 * (Detalle de un movimiento: "Guardar como frecuente") crea con esos datos.
 */
export type DesdeMovimiento = Omit<Borrador, 'monto'> & { monto: number; moneda: string };

export function PlantillaFormScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const plantillaId = nav.route.params?.plantillaId as string | undefined;
  const desde = nav.route.params?.desde as DesdeMovimiento | undefined;

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [elementosHogar, setElementosHogar] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [b, setB] = useState<Borrador>(desde ? { ...desde, monto: String(desde.monto) } : VACIO);
  const [actual, setActual] = useState<PlantillaMovimientoDTO | null>(null);

  useTitulo(plantillaId ? 'Editar frecuente' : 'Nuevo frecuente');

  useEffect(() => {
    (async () => {
      try {
        const [pls, els, hogares, delHogar] = await Promise.all([
          plantillaId
            ? api.get<PlantillaMovimientoDTO[]>('/usuarios/me/plantillas-movimiento', token)
            : Promise.resolve([]),
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
          api.get<HogarDTO[]>('/usuarios/me/hogares', token),
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token).catch(() => []),
        ]);
        setElementos(els);
        setElementosHogar(delHogar);
        setCategorias(
          hogares[0]
            ? await api.get<CategoriaMovimientoDTO[]>(`/hogares/${hogares[0].id}/categorias-movimiento`, token)
            : [],
        );
        const p = pls.find((x) => x.id === plantillaId);
        if (plantillaId && !p) return setError('Ese frecuente ya no existe.');
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

  // D-5: una transferencia puede ir a la cuenta de otro miembro del hogar.
  const propios = new Set(elementos.map((e) => e.id));
  const deMiembros = elementosHogar.filter((e) => !propios.has(e.id));
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
        toast.mostrar('Frecuente guardado');
      } else {
        await api.post(
          '/comandos/CrearPlantillaMovimiento',
          { ...campos, ...(desde && campos.monto != null ? { moneda: desde.moneda } : {}) },
          token,
        );
        toast.mostrar('Frecuente creado');
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
    if (!(await confirmar('Eliminar frecuente', `"${actual.nombre}" se borra. Los movimientos que ya registraste no cambian.`, 'Eliminar')))
      return;
    setBusy(true);
    try {
      await api.post('/comandos/EliminarPlantillaMovimiento', { plantillaId: actual.id }, token);
      toast.mostrar('Frecuente eliminado');
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
        <>
          <Nota>
            {listo
              ? `Aparece arriba al registrar un movimiento; lo que dejes en blanco lo eliges ahí.`
              : 'Ponle un nombre, p. ej. Luz.'}
          </Nota>
          <Button
            title={actual ? 'Guardar frecuente' : 'Crear frecuente'}
            onPress={guardar}
            loading={busy}
            disabled={!listo}
          />
        </>
      }
    >
      <Segmented
        options={TIPOS}
        value={b.tipo}
        onChange={(tipo) =>
          setB((x) => ({
            ...x,
            tipo,
            // D-5: la cuenta de otro miembro solo vale como destino de una transferencia.
            destinoId: tipo !== 'TRANSFERENCIA' && x.destinoId && !propios.has(x.destinoId) ? null : x.destinoId,
          }))
        }
      />
      <Field
        label="¿Cómo se llama?"
        paso={paso({ hecho: listo })}
        value={b.nombre}
        onChangeText={(nombre) => setB((x) => ({ ...x, nombre }))}
        autoCapitalize="sentences"
        placeholder="p. ej. Arriendo"
      />
      <AmountInput
        label="¿Cuánto? (opcional)"
        paso={paso()}
        value={b.monto}
        onChange={(monto) => setB((x) => ({ ...x, monto }))}
        moneda={desde?.moneda ?? 'CLP'}
      />

      {necesitaOrigen && (
        <Elegir
          label="¿Desde qué cuenta? (opcional)"
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
          label="¿A qué cuenta? (opcional)"
          paso={paso()}
          opcionNula="Sin definir"
          value={b.destinoId}
          options={[
            ...opcionesDeElementos(elementos, { saldo: false, excluir: b.origenId }),
            ...(b.tipo === 'TRANSFERENCIA' ? opcionesDeMiembros(deMiembros) : []),
          ]}
          onChange={(destinoId) => setB((x) => ({ ...x, destinoId }))}
        />
      )}

      {b.tipo !== 'TRANSFERENCIA' && catAplicables.length > 0 && (
        <Elegir
          label="¿De qué categoría? (opcional)"
          paso={paso()}
          opcionNula="Sin categoría"
          value={b.categoriaId}
          options={catAplicables.map((c) => ({ value: c.id, label: `${emojiCategoria(c) ?? '🏷️'} ${c.nombre}` }))}
          onChange={(categoriaId) => setB((x) => ({ ...x, categoriaId }))}
        />
      )}

      <Opcional titulo="Agregar detalle" abierto={!!b.glosa}>
        <Field
          label="Detalle (opcional)"
          value={b.glosa}
          onChangeText={(glosa) => setB((x) => ({ ...x, glosa }))}
          autoCapitalize="sentences"
          maxLength={140}
        />
      </Opcional>

      <ErrorText>{error}</ErrorText>
      {actual ? <AccionDestructiva title="Eliminar frecuente" onPress={borrar} /> : null}
    </Screen>
  );
}
