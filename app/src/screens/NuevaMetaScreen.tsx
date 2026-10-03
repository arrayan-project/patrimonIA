import { useEffect, useState } from 'react';
import { api, ApiError, type HogarDTO } from '../api/client';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import {
  AmountInput,
  Button,
  contadorPasos,
  ErrorText,
  Field,
  Nota,
  Screen,
  Segmented,
  Select,
} from '../ui';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({ value: m, label: `${m} — ${NOMBRE_MONEDA[m] ?? m}` }));

/** Formulario de una meta nueva (plantillas de pantalla, R2: ya no vive bajo la lista de Metas). */
export function NuevaMetaScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [compartir, setCompartir] = useState<'No' | 'Sí'>('No');
  const [moneda, setMoneda] = useState('CLP');
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const errNombre = nombre.trim() ? '' : 'Ponle un nombre a la meta.';
  const errMonto = Number(monto) > 0 ? '' : 'La meta debe ser mayor a 0.';

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) => setHogarId(hs[0]?.id ?? null))
      .catch(() => setHogarId(null));
  }, [token]);

  const crear = async () => {
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
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  return (
    <Screen
      pie={<Button title="Crear meta" onPress={crear} loading={busy} disabled={!!(errNombre || errMonto)} />}
    >
      <Field
        label="¿Cómo se llama la meta?"
        paso={paso({ hecho: !errNombre })}
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="sentences"
        placeholder="Pie vivienda"
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
      />
      <Select label="¿En qué moneda?" paso={paso({ hecho: !!moneda })} options={OPC_MONEDA} value={moneda} onChange={setMoneda} permiteOtro />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
