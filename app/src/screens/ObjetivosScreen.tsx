import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type ObjetivoFinancieroDTO } from '../api/client';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  contadorPasos,
  Ayuda,
  Button,
  EmptyState,
  ErrorText,
  etiqueta,
  AmountInput,
  Field,
  GoalCard,
  Nota,
  Section,
  Segmented,
  Select,
  Skeleton,
  Screen,
  Panel,
} from '../ui';

export function ObjetivosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [compartir, setCompartir] = useState<'No' | 'Sí'>('No');
  const [moneda, setMoneda] = useState('CLP');
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intento, setIntento] = useState(false);

  const errNombre = nombre.trim() ? '' : 'Ponle un nombre a la meta.';
  const errMonto = Number(monto) > 0 ? '' : 'La meta debe ser mayor a 0.';

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [objs, hs] = await Promise.all([
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
        api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []),
      ]);
      setObjetivos(objs);
      setHogarId(hs[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const crear = async () => {
    setIntento(true);
    if (errNombre || errMonto) return;
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearObjetivoFinanciero',
        {
          nombre: nombre.trim(),
          montoObjetivo: Number(monto),
          ...(moneda !== 'CLP' ? { moneda: moneda.trim().toUpperCase() } : {}),
          ...(compartir === 'Sí' && hogarId ? { hogarId } : {}),
        },
        token,
      );
      toast.mostrar('Meta creada');
      setNombre('');
      setMonto('');
      setMoneda('CLP');
      setCompartir('No');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  // G32 H-10 — el "+" de Planificar llega con `nuevo`: el formulario va primero.
  const nuevoArriba = nav.route.params?.nuevo === true;
  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  const formulario = (
    <Section title="Nueva meta">
      <Panel gap={14}>
        <Field
          label="¿Cómo se llama la meta?"
          paso={paso({ hecho: !errNombre })}
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="sentences"
          placeholder="Pie vivienda"
          error={intento ? errNombre : undefined}
        />
        {/* HZ-22: la decisión que cambia el significado del registro va en el paso 2. */}
        {hogarId && (
          <Segmented
            label="¿Compartir con el hogar?"
            paso={paso({ hecho: true })}
            options={['No', 'Sí'] as const}
            value={compartir}
            onChange={setCompartir}
            formatearOpcion={(v) => v}
          />
        )}
        {compartir === 'Sí' && (
          <Nota>Todos los miembros la verán. Podrás designar quiénes pueden modificarla.</Nota>
        )}
        <AmountInput
          label="¿Cuánto quieres juntar?"
          paso={paso({ hecho: !errMonto })}
          value={monto}
          onChange={setMonto}
          moneda={moneda}
          error={intento ? errMonto : undefined}
        />
        <Select label="¿En qué moneda?" paso={paso({ hecho: !!moneda })} options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
        <Button title="Crear meta" onPress={crear} loading={busy} />
      </Panel>
    </Section>
  );

  return (
    <Screen onRefresh={cargar}>
      <Ayuda>
        Una meta es algo para lo que juntas plata (el pie de una vivienda, un viaje).
        Adentro ahorras desde tus cuentas para ir viendo el avance.
      </Ayuda>

      {nuevoArriba && formulario}

      {objetivos === null ? (
        <Skeleton />
      ) : objetivos.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          titulo="Aún no tienes metas"
          descripcion={`Créalo ${nuevoArriba ? 'arriba' : 'abajo'} y luego ahorra para ella.`}
        />
      ) : (
        (() => {
          const enProgreso = objetivos.filter((o) => o.estado === 'EN_PROGRESO');
          const monedas = new Set(enProgreso.map((o) => o.moneda));
          const meta = enProgreso.reduce((s, o) => s + o.montoObjetivo, 0);
          const avance = enProgreso.reduce((s, o) => s + o.progreso, 0);
          const pct = meta > 0 ? Math.round((avance / meta) * 100) : 0;
          return enProgreso.length > 1 && monedas.size === 1 ? (
            <GoalCard
              name={`Avance total · ${enProgreso.length} metas activas`}
              hint={`${pct}%`}
              pct={pct}
              footLeft={`${money(avance, [...monedas][0])} de ${money(meta, [...monedas][0])}`}
            />
          ) : null;
        })()
      )}

      {objetivos !== null &&
        objetivos.length > 0 &&
        objetivos.map((o) => (
          <GoalCard
            key={o.id}
            name={o.hogarId ? `${o.nombre} · hogar` : o.nombre}
            hint={`${o.progresoPorcentaje}%`}
            pct={o.progresoPorcentaje}
            ok={o.estado === 'COMPLETADO' || o.progresoPorcentaje >= 100}
            footLeft={`${money(o.progreso, o.moneda)} de ${money(o.montoObjetivo, o.moneda)}`}
            footRight={etiqueta(o.estado)}
            onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
          />
        ))}

      {!nuevoArriba && formulario}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
