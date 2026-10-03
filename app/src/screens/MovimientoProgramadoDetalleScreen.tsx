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
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Button,
  DateField,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Row,
  Screen,
  Title,
  Skeleton,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

export function MovimientoProgramadoDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const movimientoId = nav.route.params?.movimientoId as string;

  const [m, setM] = useState<MovimientoProgramadoDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [modo, setModo] = useState<null | 'editar' | 'materializar' | 'cancelar'>(null);
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const mov = await api.get<MovimientoProgramadoDTO>(
        `/movimientos-programados/${movimientoId}`,
        token,
      );
      setM(mov);
      setMonto(String(mov.montoPlanificado));
      setFecha(mov.fechaProgramada.slice(0, 10));
      setElementos(
        await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
          .catch(() => []),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [movimientoId, token]);

  useCargaAlEnfocar(cargar);

  const ejecutar = async () => {
    setBusy(true);
    setError('');
    try {
      if (modo === 'editar') {
        await api.post(
          '/comandos/ActualizarMovimientoProgramado',
          { movimientoId, montoPlanificado: Number(monto), fechaProgramada: fecha },
          token,
        );
        toast.mostrar('Guardado');
        setModo(null);
        await cargar();
      } else if (modo === 'materializar') {
        await api.post(
          '/comandos/MaterializarMovimientoProgramado',
          {
            movimientoId,
            ...(monto.trim() ? { montoEfectivo: Number(monto) } : {}),
            ...(fecha.trim() ? { fechaEfectiva: fecha } : {}),
          },
          token,
        );
        toast.mostrar('Pago confirmado');
        setModo(null);
        await cargar();
      } else {
        if (!(await confirmar('Cancelar movimiento', 'El movimiento programado se cancela y ya no podrás confirmar su pago.', 'Cancelarlo'))) {
          setBusy(false);
          return;
        }
        await api.post(
          '/comandos/CancelarMovimientoProgramado',
          { movimientoId, motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Movimiento cancelado');
        nav.back();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!m) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const pendiente = m.estado === 'PENDIENTE';
  /** G32 H-05 — la cuenta es tocable si es visible para el usuario. */
  const enlaceEl = (id: string) => {
    const el = elementos.find((e) => e.id === id);
    return el ? (
      <LinkButton title={`${el.nombre} ›`} onPress={() => nav.go('ElementoDetalle', { elementoId: id })} />
    ) : (
      'otra cuenta'
    );
  };

  return (
    <Screen onRefresh={cargar}>
      <Title>Movimiento programado</Title>
      <Text style={styles.monto}>{money(m.montoPlanificado, m.moneda)}</Text>

      <Panel>
        <Row left="Tipo" right={etiqueta(m.tipo)} />
        <Row left="Estado" right={etiqueta(m.estado)} />
        <Row left="Fecha programada" right={fechaLegible(m.fechaProgramada)} />
        {m.elementoOrigenId ? <Row left="Desde" right={enlaceEl(m.elementoOrigenId)} /> : null}
        {m.elementoDestinoId ? <Row left="Hacia" right={enlaceEl(m.elementoDestinoId)} /> : null}
        {m.observaciones ? <Row left="Observaciones" right={m.observaciones} /> : null}
        {m.eventoFinancieroId ? (
          <Row
            left="Movimiento generado"
            right={
              <LinkButton
                title="Ver ›"
                onPress={() => nav.go('MovimientoDetalle', { eventoId: m.eventoFinancieroId })}
              />
            }
          />
        ) : null}
      </Panel>

      {pendiente && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Confirmar pago" onPress={() => setModo('materializar')} />
          <Button title="Editar" variant="secondary" onPress={() => setModo('editar')} />
          <Button title="Cancelar movimiento" variant="danger" onPress={() => setModo('cancelar')} />
        </View>
      )}

      {(modo === 'editar' || modo === 'materializar') && (
        <Panel>
          <Text style={styles.sectionTitle}>
            {modo === 'editar' ? 'Editar movimiento' : 'Confirmar pago'}
          </Text>
          <MoneyField
            label={modo === 'editar' ? 'Monto planificado' : 'Monto efectivo'}
            value={monto}
            onChange={setMonto}
            moneda={m.moneda}
          />
          <DateField
            label={modo === 'editar' ? 'Fecha programada' : 'Fecha efectiva'}
            value={fecha}
            onChange={setFecha}
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title={modo === 'editar' ? 'Guardar' : 'Confirmar pago'}
            onPress={ejecutar}
            loading={busy}
          />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === 'cancelar' && (
        <Panel>
          <Text style={styles.sectionTitle}>Cancelar movimiento</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Cancelar movimiento" onPress={ejecutar} loading={busy} disabled={motivo.trim().length < 3} />
          <LinkButton title="Descartar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === null && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  monto: { fontSize: 24, fontWeight: '800', color: c.text },
  sectionTitle: tipoDe(c).seccion,
});
