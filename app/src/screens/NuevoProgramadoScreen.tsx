import { useEffect, useState } from 'react';
import { api, ApiError, type CategoriaMovimientoDTO, type ElementoPatrimonialDTO, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos, opcionesDeMiembros } from '../opciones';
import { money } from '../format';
import { cadaCuando, OPCIONES_REPITE, type Periodicidad } from '../recurrencia';
import {
  AmountInput,
  Elegir,
  Button,
  contadorPasos,
  DateField,
  ErrorText,
  etiqueta,
  fechaLegible,
  Field,
  Nota,
  Opcional,
  Screen,
  Segmented,
} from '../ui';

const TIPOS = ['INGRESO', 'GASTO', 'TRANSFERENCIA'] as const;

/** Formulario de un movimiento programado nuevo (plantillas de pantalla, R2: ya no vive bajo la lista). */
export function NuevoProgramadoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [elementosHogar, setElementosHogar] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('INGRESO');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [obs, setObs] = useState('');
  // D-6: se repite cada mes o cada año, con categoría (solo ingreso y gasto).
  const [repite, setRepite] = useState<'NO' | Periodicidad>('NO');
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);

  const usaOrigen = tipo === 'GASTO' || tipo === 'TRANSFERENCIA';
  const usaDestino = tipo === 'INGRESO' || tipo === 'TRANSFERENCIA';

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
      .then(setElementos)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error'));
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token)
      .then(setElementosHogar)
      .catch(() => setElementosHogar([]));
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) =>
        hs[0] ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hs[0].id}/categorias-movimiento`, token) : [],
      )
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [token]);

  // D-5: una transferencia puede ir a la cuenta de otro miembro del hogar (las
  // que comparte desde "Que puedan transferirte"); el origen sigue siendo propio.
  const propios = new Set(elementos.map((e) => e.id));
  const deMiembros = elementosHogar.filter((e) => !propios.has(e.id));
  const cambiarTipo = (t: (typeof TIPOS)[number]) => {
    setTipo(t);
    setCategoriaId(null);
    if (t !== 'TRANSFERENCIA' && destinoId && !propios.has(destinoId)) setDestinoId(null);
  };

  const catAplicables = categorias.filter(
    (c) => c.estado === 'ACTIVA' && (c.tipoAplicable === 'AMBOS' || c.tipoAplicable === tipo),
  );
  const origen = elementos.find((e) => e.id === origenId);
  const destino = [...elementos, ...deMiembros].find((e) => e.id === destinoId);
  const monedaRef = (usaOrigen ? origen : destino)?.moneda;

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim());
  const puedeCrear =
    Number(monto) > 0 &&
    fechaValida &&
    (!usaOrigen || !!origenId) &&
    (!usaDestino || !!destinoId) &&
    (tipo !== 'TRANSFERENCIA' || origenId !== destinoId);

  const crear = async () => {
    if (!puedeCrear || !monedaRef) return;
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearMovimientoProgramado',
        {
          tipo,
          montoPlanificado: Number(monto),
          moneda: monedaRef,
          fechaProgramada: fecha.trim(),
          ...(usaOrigen && origen ? { elementoOrigenId: origen.id } : {}),
          ...(usaDestino && destino ? { elementoDestinoId: destino.id } : {}),
          ...(obs.trim() ? { observaciones: obs.trim() } : {}),
          ...(repite !== 'NO' ? { periodicidad: repite } : {}),
          ...(tipo !== 'TRANSFERENCIA' && categoriaId ? { categoriaId } : {}),
        },
        token,
      );
      toast.mostrar('Movimiento programado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const nombreDe = (id: string | null) => [...elementos, ...deMiembros].find((e) => e.id === id)?.nombre ?? '';
  const m = monedaRef ? `${Number(monto) ? money(Number(monto), monedaRef) : ''}` : '';
  const cuando = !fechaValida ? '' : repite !== 'NO' ? ` ${cadaCuando(repite, fecha)}` : ` el ${fechaLegible(fecha)}`;
  const aviso = repite !== 'NO' ? 'Te avisamos' : 'Te recordamos';
  const resumen = !puedeCrear
    ? 'Completa monto, cuenta y fecha.'
    : tipo === 'INGRESO'
      ? `${aviso}${cuando} para confirmar que entraron ${m} a ${nombreDe(destinoId)}.`
      : tipo === 'GASTO'
        ? `${aviso}${cuando} para confirmar que salieron ${m} de ${nombreDe(origenId)}.`
        : `${aviso}${cuando} para confirmar el paso de ${m} de ${nombreDe(origenId)} a ${nombreDe(destinoId)}.`;

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <>
          <Nota>{resumen}</Nota>
          <Button
            title={`Programar ${etiqueta(tipo).toLowerCase()}`}
            onPress={crear}
            loading={busy}
            disabled={!puedeCrear || !monedaRef}
          />
        </>
      }
    >
      <Segmented options={TIPOS} value={tipo} onChange={cambiarTipo} />
      <AmountInput label="¿Cuánto?" paso={paso({ hecho: Number(monto) > 0 })} value={monto} onChange={setMonto} moneda={monedaRef} />
      {usaOrigen && (
        <Elegir
          label={tipo === 'GASTO' ? '¿Desde qué cuenta sale?' : '¿Desde qué cuenta?'}
          paso={paso({ hecho: !!origenId })}
          placeholder="Elegir cuenta"
          value={origenId}
          options={opcionesDeElementos(elementos, { saldo: false })}
          onChange={(v) => {
            setOrigenId(v);
            if (v === destinoId) setDestinoId(null);
          }}
        />
      )}
      {usaDestino && (
        <Elegir
          label={tipo === 'INGRESO' ? '¿A qué cuenta llega?' : '¿A qué cuenta?'}
          paso={paso({ hecho: !!destinoId })}
          placeholder="Elegir cuenta"
          value={destinoId}
          options={[
            ...opcionesDeElementos(elementos, { saldo: false, excluir: usaOrigen ? origenId : null }),
            ...(tipo === 'TRANSFERENCIA' ? opcionesDeMiembros(deMiembros) : []),
          ]}
          onChange={setDestinoId}
        />
      )}
      {tipo !== 'TRANSFERENCIA' && catAplicables.length > 0 && (
        <Elegir
          label="¿De qué categoría? (opcional)"
          paso={paso({ opcional: true })}
          opcionNula="Sin categoría"
          value={categoriaId}
          options={catAplicables.map((c) => ({ value: c.id, label: c.nombre }))}
          onChange={setCategoriaId}
        />
      )}
      <Elegir
        label="¿Se repite?"
        paso={paso({ hecho: true })}
        value={repite}
        options={OPCIONES_REPITE}
        onChange={(v) => setRepite((v as 'NO' | Periodicidad | null) ?? 'NO')}
      />
      <DateField
        label={repite !== 'NO' ? '¿Cuándo es la primera vez?' : '¿Para cuándo?'}
        paso={paso({ hecho: fechaValida })}
        value={fecha}
        onChange={setFecha}
      />
      <Opcional titulo="Agregar detalle" abierto={!!obs}>
        <Field label="Detalle (opcional)" value={obs} onChangeText={setObs} autoCapitalize="sentences" placeholder="p. ej. sueldo de octubre" />
      </Opcional>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
