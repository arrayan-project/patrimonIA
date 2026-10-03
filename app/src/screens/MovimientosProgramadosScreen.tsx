import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type MovimientoProgramadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  contadorPasos,
  Etiqueta,
  Ayuda,
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Segmented,
  Skeleton,
  Screen,
  SelectRow,
  Title,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

const TIPOS = ['INGRESO', 'GASTO', 'TRANSFERENCIA'] as const;

export function MovimientosProgramadosScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const [lista, setLista] = useState<MovimientoProgramadoDTO[] | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intento, setIntento] = useState(false);

  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('INGRESO');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [obs, setObs] = useState('');

  const usaOrigen = tipo === 'GASTO' || tipo === 'TRANSFERENCIA';
  const usaDestino = tipo === 'INGRESO' || tipo === 'TRANSFERENCIA';

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [movs, els] = await Promise.all([
        api.get<MovimientoProgramadoDTO[]>('/movimientos-programados', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      setLista(movs);
      setElementos(els);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const origen = elementos.find((e) => e.id === origenId);
  const destino = elementos.find((e) => e.id === destinoId);
  const monedaRef = (usaOrigen ? origen : destino)?.moneda;

  const crear = async () => {
    setIntento(true);
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
        },
        token,
      );
      toast.mostrar('Movimiento programado');
      setMonto('');
      setFecha('');
      setObs('');
      setOrigenId(null);
      setDestinoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim());
  const puedeCrear =
    Number(monto) > 0 &&
    fechaValida &&
    (!usaOrigen || !!origenId) &&
    (!usaDestino || !!destinoId) &&
    (tipo !== 'TRANSFERENCIA' || origenId !== destinoId);
  const errMonto = Number(monto) > 0 ? '' : 'Ingresa un monto mayor a 0.';
  const errFecha = fechaValida ? '' : 'Elige una fecha.';

  // HZ-19: numera las preguntas del formulario en el orden en que se muestran.
  const paso = contadorPasos();
  return (
    <Screen onRefresh={cargar}>
      <Title>Movimientos programados</Title>

      <Ayuda>
        Un movimiento futuro con fecha: un ingreso (sueldo), un gasto (arriendo) o
        una transferencia. Cuando llega la fecha, confirmas el pago y recién ahí
        entra como un movimiento real.
      </Ayuda>

      {lista === null ? (
        <Skeleton />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          titulo="No tienes movimientos programados"
          descripcion="Créalo abajo."
        />
      ) : (
        lista.map((m) => (
          <Card
            key={m.id}
            onPress={() => nav.go('MovimientoProgramadoDetalle', { movimientoId: m.id })}
          >
            <View style={styles.head}>
              <Text style={styles.nombre}>{money(m.montoPlanificado, m.moneda)}</Text>
              <Text style={styles.estado}>{etiqueta(m.estado)}</Text>
            </View>
            <Text style={styles.muted}>
              {etiqueta(m.tipo)} · programado para {fechaLegible(m.fechaProgramada)}
            </Text>
            {m.observaciones ? <Text style={styles.muted}>{m.observaciones}</Text> : null}
          </Card>
        ))
      )}

      <Panel>
        <Text style={styles.nombre}>Nuevo movimiento programado</Text>
        <Segmented label="Tipo" options={TIPOS} value={tipo} onChange={setTipo} paso={paso()} />
        <MoneyField
          label="Monto planificado"
          paso={paso()}
          value={monto}
          onChange={setMonto}
          moneda={monedaRef}
          error={intento ? errMonto : undefined}
        />
        <DateField label="Fecha" paso={paso()} value={fecha} onChange={setFecha} error={intento ? errFecha : undefined} />
        {usaOrigen && (
          <>
            <Etiqueta paso={paso()}>Desde qué cuenta</Etiqueta>
            {elementos.map((el) => (
              <SelectRow
                key={el.id}
                label={`${el.nombre} · ${el.moneda}`}
                selected={origenId === el.id}
                onPress={() => setOrigenId(el.id)}
              />
            ))}
          </>
        )}
        {usaDestino && (
          <>
            <Etiqueta paso={paso()}>A qué cuenta</Etiqueta>
            {elementos.map((el) => (
              <SelectRow
                key={el.id}
                label={`${el.nombre} · ${el.moneda}`}
                selected={destinoId === el.id}
                onPress={() => setDestinoId(el.id)}
              />
            ))}
          </>
        )}
        <Field label="Observaciones (opcional)" paso={paso()} value={obs} onChangeText={setObs} autoCapitalize="sentences" />
        <Button title="Programar" onPress={crear} loading={busy} />
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: c.text },
  estado: { fontSize: 12, fontWeight: '600', color: c.muted },
  muted: tipoDe(c).nota,
  label: { fontSize: 13, fontWeight: '600', color: c.text },
});
