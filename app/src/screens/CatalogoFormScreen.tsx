import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  api,
  ApiError,
  type AgrupacionDTO,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type EtiquetaDTO,
  type HogarDTO,
  type TipoElementoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav, useTitulo } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { emojiCategoria } from '../emojis';
import { useToast } from '../ui/Toast';
import {
  AccionDestructiva,
  BloquePaso,
  Button,
  contadorPasos,
  DateField,
  ElegirEmoji,
  ElegirVarios,
  ErrorText,
  etiqueta,
  Field,
  PALETA_CATEGORIA,
  Question,
  Screen,
  Segmented,
  Select,
  Skeleton,
  useC,
  type Paleta,
} from '../ui';

/**
 * Formulario de creación (y edición) que comparten los catálogos simples
 * (plantillas de pantalla, R2). Sin `id` crea; con `id` edita con los datos
 * cargados y ofrece archivar o eliminar al final. Tipos de cambio solo se
 * registran.
 */
export type Catalogo = 'categoria' | 'etiqueta' | 'tipoElemento' | 'agrupacion' | 'tipoCambio';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Error inesperado');

export function CatalogoFormScreen() {
  const nav = useNav();
  const catalogo = nav.route.params?.catalogo as Catalogo;
  const id = nav.route.params?.id as string | undefined;
  switch (catalogo) {
    case 'categoria':
      return <FormCategoria id={id} />;
    case 'etiqueta':
      return <FormEtiqueta id={id} />;
    case 'tipoElemento':
      return <FormTipoElemento id={id} />;
    case 'agrupacion':
      return <FormAgrupacion id={id} />;
    default:
      return <FormTipoCambio />;
  }
}

/** Guardar o borrar: avisa con un toast y vuelve a la Lista; si falla, muestra el error. */
function useEnvio() {
  const nav = useNav();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>, aviso: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast.mostrar(aviso);
      nav.back();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Lo común: título, pie con la acción completa y la acción destructiva al final. */
function FormCatalogo({
  titulo,
  cargado,
  error,
  accion,
  listo,
  busy,
  onGuardar,
  destructiva,
  children,
}: {
  titulo: string;
  cargado: boolean;
  error: string;
  accion: string;
  listo: boolean;
  busy: boolean;
  onGuardar: () => void;
  destructiva?: { title: string; onPress: () => void };
  children: ReactNode;
}) {
  useTitulo(titulo);
  if (!cargado) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }
  return (
    <Screen pie={<Button title={accion} onPress={onGuardar} loading={busy} disabled={!listo} />}>
      {children}
      <ErrorText>{error}</ErrorText>
      {destructiva ? <AccionDestructiva {...destructiva} /> : null}
    </Screen>
  );
}

async function hogarDe(token: string | null): Promise<string | null> {
  const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
  return hogares[0]?.id ?? null;
}

const TIPOS_CATEGORIA = ['GASTO', 'INGRESO', 'AMBOS'] as const;

function FormCategoria({ id }: { id?: string }) {
  const { token } = useSession();
  const { busy, error, setError, run } = useEnvio();
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [lista, setLista] = useState<CategoriaMovimientoDTO[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS_CATEGORIA)[number]>('GASTO');
  const [padre, setPadre] = useState('');
  // G35: el emoji de la categoría (`icono`). null = el que corresponde a su nombre.
  const [emoji, setEmoji] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const h = await hogarDe(token);
        const cats = h
          ? await api.get<CategoriaMovimientoDTO[]>(`/hogares/${h}/categorias-movimiento`, token)
          : [];
        const actual = cats.find((x) => x.id === id);
        if (actual) {
          setNombre(actual.nombre);
          setTipo(actual.tipoAplicable);
          setPadre(actual.categoriaPadreId ?? '');
          setEmoji(actual.icono && !/^[a-z-]+$/.test(actual.icono) ? actual.icono : null);
        }
        setHogarId(h);
        setLista(cats);
      } catch (e) {
        setError(msg(e));
      }
    })();
  }, [token, id, setError]);

  const actual = lista?.find((x) => x.id === id);
  // Dos niveles: el padre es una raíz, nunca la misma categoría.
  const opcPadre = [
    { value: '', label: 'Ninguna (categoría principal)' },
    ...(lista ?? [])
      .filter((x) => !x.categoriaPadreId && x.id !== id)
      .map((r) => ({ value: r.id, label: r.nombre })),
  ];
  const paso = contadorPasos();
  const emojiVisible = emoji ?? emojiCategoria({ nombre, icono: null }) ?? '🏷️';

  const guardar = () =>
    actual
      ? run(async () => {
          const body: Record<string, unknown> = { categoriaId: actual.id };
          if (nombre.trim() !== actual.nombre) body.nombre = nombre.trim();
          if (padre !== (actual.categoriaPadreId ?? '')) body.categoriaPadreId = padre || null;
          if (emojiVisible !== actual.icono) body.icono = emojiVisible;
          await api.post('/comandos/ActualizarCategoriaMovimiento', body, token);
        }, 'Guardado')
      : run(
          () =>
            api.post(
              '/comandos/CrearCategoriaMovimiento',
              {
                hogarId,
                nombre: nombre.trim(),
                tipoAplicable: tipo,
                icono: emojiVisible,
                ...(padre ? { categoriaPadreId: padre } : {}),
              },
              token,
            ),
          'Categoría creada',
        );

  const archivar = async () => {
    if (!actual) return;
    if (!(await confirmar('Archivar categoría', `"${actual.nombre}" deja de aparecer al registrar movimientos. Los movimientos ya clasificados no cambian.`, 'Archivar')))
      return;
    await run(
      () => api.post('/comandos/ArchivarCategoriaMovimiento', { categoriaId: actual.id }, token),
      'Categoría archivada',
    );
  };

  return (
    <FormCatalogo
      titulo={actual ? 'Editar categoría' : 'Nueva categoría'}
      cargado={lista !== null && (!id || !!actual)}
      error={error}
      accion={actual ? 'Guardar categoría' : 'Crear categoría'}
      listo={!!nombre.trim() && !!hogarId}
      busy={busy}
      onGuardar={guardar}
      destructiva={actual ? { title: 'Archivar categoría', onPress: archivar } : undefined}
    >
      <Field
        label="¿Cómo se llama?"
        paso={paso({ hecho: !!nombre.trim() })}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="sentences"
        placeholder="p. ej. Mascotas"
      />
      <ElegirEmoji value={emojiVisible} onChange={setEmoji} />
      {!actual && (
        <Segmented
          label="¿Para qué movimientos?"
          paso={paso({ hecho: true })}
          options={TIPOS_CATEGORIA}
          value={tipo}
          onChange={setTipo}
        />
      )}
      <Select
        label="¿Va dentro de otra categoría? (opcional)"
        paso={paso()}
        options={opcPadre}
        value={padre}
        onChange={setPadre}
      />
    </FormCatalogo>
  );
}

function FormEtiqueta({ id }: { id?: string }) {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const { busy, error, setError, run } = useEnvio();
  const [actual, setActual] = useState<EtiquetaDTO | null>(null);
  const [cargado, setCargado] = useState(!id);
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const e = (await api.get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token)).find((x) => x.id === id);
        if (e) {
          setActual(e);
          setNombre(e.nombre);
          setColor(e.color);
          setCargado(true);
        } else setError('La etiqueta ya no existe.');
      } catch (e) {
        setError(msg(e));
      }
    })();
  }, [token, id, setError]);

  const paso = contadorPasos();

  const guardar = () =>
    actual
      ? run(
          () =>
            api.post(
              '/comandos/ActualizarEtiqueta',
              { etiquetaId: actual.id, nombre: nombre.trim(), color },
              token,
            ),
          'Guardado',
        )
      : run(
          () => api.post('/comandos/CrearEtiqueta', { nombre: nombre.trim(), ...(color ? { color } : {}) }, token),
          'Etiqueta creada',
        );

  const borrar = async () => {
    if (!actual) return;
    if (!(await confirmar('Eliminar etiqueta', `"${actual.nombre}" se quita de todos los movimientos que la tenían.`, 'Eliminar')))
      return;
    await run(() => api.post('/comandos/EliminarEtiqueta', { etiquetaId: actual.id }, token), 'Etiqueta eliminada');
  };

  const pNombre = paso({ hecho: !!nombre.trim() });
  const pColor = paso();
  return (
    <FormCatalogo
      titulo={actual ? 'Editar etiqueta' : 'Nueva etiqueta'}
      cargado={cargado}
      error={error}
      accion={actual ? 'Guardar etiqueta' : 'Crear etiqueta'}
      listo={!!nombre.trim()}
      busy={busy}
      onGuardar={guardar}
      destructiva={actual ? { title: 'Eliminar etiqueta', onPress: borrar } : undefined}
    >
      <Field
        label="¿Cómo se llama?"
        paso={pNombre}
        value={nombre}
        onChangeText={setNombre}
        placeholder="p. ej. reembolsable"
      />
      <BloquePaso paso={pColor} style={styles.campo}>
        <Question paso={pColor} opcional>
          ¿De qué color?
        </Question>
        <View style={styles.colores}>
          <Pressable
            onPress={() => setColor(null)}
            accessibilityRole="button"
            accessibilityLabel="Sin color"
            accessibilityState={{ selected: !color }}
          >
            <View style={[styles.swatch, !color && styles.swatchSel, { backgroundColor: c.faint }]} />
          </Pressable>
          {PALETA_CATEGORIA.map((col) => (
            <Pressable
              key={col}
              onPress={() => setColor(col)}
              accessibilityRole="button"
              accessibilityLabel={`Color ${col}`}
              accessibilityState={{ selected: color === col }}
            >
              <View style={[styles.swatch, color === col && styles.swatchSel, { backgroundColor: col }]} />
            </Pressable>
          ))}
        </View>
      </BloquePaso>
    </FormCatalogo>
  );
}

const OPC_CAT_ELEMENTO = [
  { value: '', label: 'Sin sugerencia' },
  ...(['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const).map((v) => ({
    value: v,
    label: etiqueta(v),
  })),
];

function FormTipoElemento({ id }: { id?: string }) {
  const { token } = useSession();
  const { busy, error, setError, run } = useEnvio();
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [actual, setActual] = useState<TipoElementoDTO | null>(null);
  const [cargado, setCargado] = useState(false);
  const [nombre, setNombre] = useState('');
  const [cat, setCat] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const h = await hogarDe(token);
        setHogarId(h);
        if (id && h) {
          const t = (await api.get<TipoElementoDTO[]>(`/hogares/${h}/tipos-elemento`, token)).find(
            (x) => x.id === id,
          );
          if (!t) return setError('El tipo ya no existe.');
          setActual(t);
          setNombre(t.nombre);
          setCat(t.categoriaSugerida ?? '');
        }
        setCargado(true);
      } catch (e) {
        setError(msg(e));
      }
    })();
  }, [token, id, setError]);

  const paso = contadorPasos();

  const guardar = () =>
    actual
      ? run(async () => {
          const body: Record<string, unknown> = { tipoId: actual.id };
          if (nombre.trim() !== actual.nombre) body.nombre = nombre.trim();
          if (cat !== (actual.categoriaSugerida ?? '')) body.categoriaSugerida = cat || null;
          await api.post('/comandos/ActualizarTipoElemento', body, token);
        }, 'Guardado')
      : run(
          () =>
            api.post(
              '/comandos/CrearTipoElemento',
              { hogarId, nombre: nombre.trim(), ...(cat ? { categoriaSugerida: cat } : {}) },
              token,
            ),
          'Tipo creado',
        );

  const archivar = async () => {
    if (!actual) return;
    if (!(await confirmar('Archivar tipo', `"${actual.nombre}" deja de sugerirse al agregar cuentas o bienes. Los elementos ya creados no cambian.`, 'Archivar')))
      return;
    await run(() => api.post('/comandos/ArchivarTipoElemento', { tipoId: actual.id }, token), 'Tipo archivado');
  };

  return (
    <FormCatalogo
      titulo={actual ? 'Editar tipo' : 'Nuevo tipo'}
      cargado={cargado}
      error={error}
      accion={actual ? 'Guardar tipo' : 'Crear tipo'}
      listo={!!nombre.trim() && !!hogarId}
      busy={busy}
      onGuardar={guardar}
      destructiva={actual ? { title: 'Archivar tipo', onPress: archivar } : undefined}
    >
      <Field
        label="¿Cómo se llama?"
        paso={paso({ hecho: !!nombre.trim() })}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="sentences"
        placeholder="p. ej. Billetera digital"
      />
      <Select
        label="¿Qué categoría sugiere? (opcional)"
        paso={paso()}
        options={OPC_CAT_ELEMENTO}
        value={cat}
        onChange={setCat}
      />
    </FormCatalogo>
  );
}

function FormAgrupacion({ id }: { id?: string }) {
  const { token } = useSession();
  const { busy, error, setError, run } = useEnvio();
  const [lista, setLista] = useState<AgrupacionDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [nombre, setNombre] = useState('');
  const [sel, setSel] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [ags, els] = await Promise.all([
          api.get<AgrupacionDTO[]>('/usuarios/me/agrupaciones', token),
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
        ]);
        const a = ags.find((x) => x.id === id);
        if (a) {
          setNombre(a.nombre);
          setSel(a.elementoIds);
        }
        setElementos(els);
        setLista(ags);
      } catch (e) {
        setError(msg(e));
      }
    })();
  }, [token, id, setError]);

  const actual = lista?.find((x) => x.id === id);
  const paso = contadorPasos();

  const guardar = () =>
    run(
      async () => {
        let agrupacionId = actual?.id;
        if (actual) {
          if (nombre.trim() !== actual.nombre)
            await api.post('/comandos/ActualizarAgrupacion', { agrupacionId, nombre: nombre.trim() }, token);
        } else {
          agrupacionId = (await api.post<AgrupacionDTO>('/comandos/CrearAgrupacion', { nombre: nombre.trim() }, token)).id;
        }
        const antes = actual?.elementoIds ?? [];
        if (sel.length !== antes.length || sel.some((x) => !antes.includes(x)))
          await api.post('/comandos/DefinirElementosAgrupacion', { agrupacionId, elementoIds: sel }, token);
      },
      actual ? 'Guardado' : 'Agrupación creada',
    );

  const borrar = async () => {
    if (!actual) return;
    if (!(await confirmar('Eliminar agrupación', `"${actual.nombre}" se borra. Sus elementos quedan sin agrupar (no se pierde nada).`, 'Eliminar')))
      return;
    await run(() => api.post('/comandos/EliminarAgrupacion', { agrupacionId: actual.id }, token), 'Agrupación eliminada');
  };

  return (
    <FormCatalogo
      titulo={actual ? 'Editar agrupación' : 'Nueva agrupación'}
      cargado={lista !== null && (!id || !!actual)}
      error={error}
      accion={actual ? 'Guardar agrupación' : 'Crear agrupación'}
      listo={!!nombre.trim()}
      busy={busy}
      onGuardar={guardar}
      destructiva={actual ? { title: 'Eliminar agrupación', onPress: borrar } : undefined}
    >
      <Field
        label="¿Cómo se llama?"
        paso={paso({ hecho: !!nombre.trim() })}
        value={nombre}
        onChangeText={setNombre}
        placeholder="p. ej. Inversiones"
      />
      <ElegirVarios
        label="¿Qué cuentas o bienes van dentro? (opcional)"
        paso={paso()}
        values={sel}
        onChange={setSel}
        options={elementos.map((el) => {
          const otra = (lista ?? []).find((a) => a.id !== id && a.elementoIds.includes(el.id));
          return {
            value: el.id,
            label: el.nombre,
            sub: `${money(el.valorVigente, el.moneda)}${otra ? ` · hoy en "${otra.nombre}"` : ''}`,
          };
        })}
      />
    </FormCatalogo>
  );
}

function FormTipoCambio() {
  const { token } = useSession();
  const { busy, error, run } = useEnvio();
  const [origen, setOrigen] = useState('USD');
  const [destino, setDestino] = useState('CLP');
  const [tasa, setTasa] = useState('');
  const [fecha, setFecha] = useState('');

  const errOrigen = origen.trim().length === 3 ? '' : 'Código de 3 letras (p. ej. USD).';
  const errDestino =
    destino.trim().length !== 3
      ? 'Código de 3 letras (p. ej. CLP).'
      : destino.trim().toUpperCase() === origen.trim().toUpperCase()
        ? 'Las dos monedas no pueden ser la misma.'
        : '';
  const errTasa = Number(tasa) > 0 ? '' : 'Ingresa una tasa mayor a 0.';
  const paso = contadorPasos();

  const registrar = () =>
    run(
      () =>
        api.post(
          '/comandos/RegistrarTipoCambio',
          {
            monedaOrigen: origen.trim().toUpperCase(),
            monedaDestino: destino.trim().toUpperCase(),
            tasa: Number(tasa),
            ...(fecha.trim() ? { fechaVigencia: fecha.trim() } : {}),
          },
          token,
        ),
      'Tipo de cambio registrado',
    );

  return (
    <FormCatalogo
      titulo="Registrar tasa"
      cargado
      error={error}
      accion="Registrar tasa"
      listo={!errOrigen && !errDestino && !errTasa}
      busy={busy}
      onGuardar={registrar}
    >
      <Field
        label="¿Desde qué moneda?"
        paso={paso({ hecho: !errOrigen })}
        value={origen}
        onChangeText={setOrigen}
        maxLength={3}
        autoCapitalize="characters"
        error={origen ? errOrigen || undefined : undefined}
      />
      <Field
        label="¿A qué moneda?"
        paso={paso({ hecho: !errDestino })}
        value={destino}
        onChangeText={setDestino}
        maxLength={3}
        autoCapitalize="characters"
        error={destino ? errDestino || undefined : undefined}
      />
      <Field
        label={`¿Cuántos ${destino.trim().toUpperCase() || 'CLP'} vale 1 ${origen.trim().toUpperCase() || 'USD'}?`}
        paso={paso({ hecho: !errTasa })}
        keyboardType="numeric"
        value={tasa}
        onChangeText={setTasa}
        placeholder="950"
      />
      <DateField
        label="¿Desde cuándo rige? (opcional)"
        paso={paso()}
        value={fecha}
        onChange={setFecha}
        optional
      />
    </FormCatalogo>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    campo: { gap: 8 },
    colores: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
    swatchSel: { borderColor: c.text },
  });
