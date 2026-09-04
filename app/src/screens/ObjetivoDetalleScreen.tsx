import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ObjetivoFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  Button,
  colors,
  ErrorText,
  etiqueta,
  Field,
  LinkButton,
  ProgressBar,
  Row,
  Screen,
  Segmented,
  Title,
  Skeleton,
  panel,
  tipo,
} from '../ui';

const ESTADOS = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;

export function ObjetivoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const objetivoId = nav.route.params?.objetivoId as string;

  const [obj, setObj] = useState<ObjetivoFinancieroDTO | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  const [nombreAsg, setNombreAsg] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<(typeof ESTADOS)[number]>('EN_PROGRESO');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const o = await api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${objetivoId}`, token);
      setObj(o);
      setNuevoEstado(o.estado as (typeof ESTADOS)[number]);
      setAsignaciones(await api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [objetivoId, token]);

  useCargaAlEnfocar(cargar);

  const run = async (fn: () => Promise<unknown>, salir = false) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (salir) nav.back();
      else await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!obj) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <Title>{obj.nombre}</Title>
      <ProgressBar pct={obj.progresoPorcentaje} />
      <Text style={styles.muted}>
        {money(obj.progreso, 'CLP')} de {money(obj.montoObjetivo, 'CLP')} · {obj.progresoPorcentaje}% ·{' '}
        {etiqueta(obj.estado)}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Asignaciones</Text>
        {asignaciones.map((a) => (
          <Pressable
            key={a.id}
            style={styles.asg}
            onPress={() =>
              nav.go('AsignacionDetalle', { asignacionId: a.id, contexto: obj.nombre })
            }
          >
            <Row left={a.nombre} right={money(a.totalReservado, 'CLP')} />
          </Pressable>
        ))}
        <Field label="Nueva asignación" value={nombreAsg} onChangeText={setNombreAsg} autoCapitalize="sentences" />
        <Button
          title="Crear asignación"
          variant="secondary"
          loading={busy}
          disabled={!nombreAsg.trim()}
          onPress={() =>
            run(async () => {
              await api.post(
                '/comandos/CrearAsignacion',
                { nombre: nombreAsg.trim(), objetivoId },
                token,
              );
              setNombreAsg('');
            })
          }
        />
      </View>

      <View style={styles.card}>
        <Segmented label="Estado" options={ESTADOS} value={nuevoEstado} onChange={setNuevoEstado} />
        <Button
          title="Cambiar estado"
          variant="secondary"
          loading={busy}
          disabled={nuevoEstado === obj.estado}
          onPress={() =>
            run(() =>
              api.post(
                '/comandos/CambiarEstadoObjetivoFinanciero',
                { objetivoId, estado: nuevoEstado },
                token,
              ),
            )
          }
        />
        <Field label="Motivo (para eliminar)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        <Button
          title="Eliminar objetivo"
          variant="secondary"
          loading={busy}
          disabled={motivo.trim().length < 3}
          onPress={() =>
            run(
              () =>
                api.post(
                  '/comandos/EliminarObjetivoFinanciero',
                  { objetivoId, motivo: motivo.trim() },
                  token,
                ),
              true,
            )
          }
        />
      </View>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { ...panel, gap: 10 },
  sectionTitle: tipo.seccion,
  asg: { borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 4 },
  muted: tipo.nota,
});
