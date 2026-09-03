import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type MovimientoProgramadoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Button,
  colors,
  DateField,
  ErrorText,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Row,
  Screen,
  Title,
} from '../ui';

export function MovimientoProgramadoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const movimientoId = nav.route.params?.movimientoId as string;

  const [m, setM] = useState<MovimientoProgramadoDTO | null>(null);
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
        toast.mostrar('Movimiento materializado');
        setModo(null);
        await cargar();
      } else {
        if (!(await confirmar('Cancelar movimiento', 'El movimiento programado se cancela y no podrá materializarse.', 'Cancelarlo'))) {
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
        {!error && <ActivityIndicator color={colors.primary} />}
        <LinkButton title="Volver" onPress={nav.back} />
      </Screen>
    );
  }

  const pendiente = m.estado === 'PENDIENTE';

  return (
    <Screen onRefresh={cargar}>
      <Title>Movimiento programado</Title>
      <Text style={styles.monto}>{money(m.montoPlanificado, m.moneda)}</Text>

      <View style={styles.card}>
        <Row left="Estado" right={m.estado} />
        <Row left="Fecha programada" right={fechaLegible(m.fechaProgramada)} />
        {m.observaciones ? <Row left="Observaciones" right={m.observaciones} /> : null}
        {m.eventoFinancieroId ? <Row left="Evento generado" right={m.eventoFinancieroId.slice(0, 8)} /> : null}
      </View>

      {pendiente && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Materializar ahora" onPress={() => setModo('materializar')} />
          <Button title="Editar" variant="secondary" onPress={() => setModo('editar')} />
          <Button title="Cancelar movimiento" variant="danger" onPress={() => setModo('cancelar')} />
        </View>
      )}

      {(modo === 'editar' || modo === 'materializar') && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {modo === 'editar' ? 'Editar movimiento' : 'Materializar'}
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
            title={modo === 'editar' ? 'Guardar' : 'Materializar'}
            onPress={ejecutar}
            loading={busy}
          />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </View>
      )}

      {modo === 'cancelar' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cancelar movimiento</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Cancelar movimiento" onPress={ejecutar} loading={busy} disabled={motivo.trim().length < 3} />
          <LinkButton title="Volver" onPress={() => setModo(null)} />
        </View>
      )}

      {modo === null && <ErrorText>{error}</ErrorText>}
      <LinkButton title="Volver" onPress={nav.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monto: { fontSize: 24, fontWeight: '800', color: colors.text },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
});
