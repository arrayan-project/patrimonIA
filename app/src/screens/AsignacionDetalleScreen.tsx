import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { GLOSARIO } from '../labels';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  ErrorText,
  Field,
  LinkButton,
  Migaja,
  MoneyField,
  Row,
  Screen,
  SelectRow,
  Title,
  Skeleton,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

export function AsignacionDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const asignacionId = nav.route.params?.asignacionId as string;
  const contexto = nav.route.params?.contexto as string | undefined;

  const [asg, setAsg] = useState<AsignacionDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setAsg(await api.get<AsignacionDTO>(`/asignaciones/${asignacionId}`, token));
      setElementos(
        await api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [asignacionId, token]);

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

  if (!asg) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const nombrePorId = new Map(elementos.map((e) => [e.id, e.nombre]));
  const reservasActivas = (asg.reservas ?? []).filter((r) => r.estado === 'ACTIVA');

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Title>{asg.nombre}</Title>
      <Text style={styles.muted}>Total apartado: {money(asg.totalReservado, asg.moneda)}</Text>

      <Ayuda>{GLOSARIO.apartado}</Ayuda>

      <Panel>
        <Text style={styles.sectionTitle}>Apartado desde</Text>
        {reservasActivas.length === 0 ? (
          <Text style={styles.muted}>Aún no apartas dinero aquí.</Text>
        ) : (
          reservasActivas.map((r) => (
            <View key={r.id} style={styles.reserva}>
              <Row
                left={nombrePorId.get(r.elementoOrigenId) ?? 'Cuenta'}
                right={money(r.monto, asg.moneda)}
              />
              <Button
                title="Liberar"
                variant="secondary"
                loading={busy}
                disabled={motivo.trim().length < 3}
                onPress={() =>
                  run(() =>
                    api.post(
                      '/comandos/LiberarReserva',
                      { reservaId: r.id, motivo: motivo.trim() },
                      token,
                    ),
                  )
                }
              />
            </View>
          ))
        )}
      </Panel>

      <Panel>
        <Text style={styles.sectionTitle}>Apartar más dinero</Text>
        {elementos.map((el) => (
          <SelectRow
            key={el.id}
            label={`${el.nombre} · ${money(el.valorVigente, el.moneda)}`}
            selected={origenId === el.id}
            onPress={() => setOrigenId(el.id)}
          />
        ))}
        <MoneyField label="Monto a apartar" value={monto} onChange={setMonto} />
        <Button
          title="Apartar dinero"
          loading={busy}
          disabled={!origenId || !(Number(monto) > 0)}
          onPress={() =>
            run(async () => {
              await api.post(
                '/comandos/CrearReserva',
                { asignacionId, elementoOrigenId: origenId, monto: Number(monto) },
                token,
              );
              toast.mostrar('Dinero apartado');
              setMonto('');
              setOrigenId(null);
            })
          }
        />
      </Panel>

      <Panel>
        <Field label="Motivo (para liberar o eliminar)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        <Button
          title="Eliminar apartado"
          variant="danger"
          loading={busy}
          disabled={motivo.trim().length < 3}
          onPress={async () => {
            if (
              !(await confirmar(
                'Eliminar apartado',
                'Se libera todo el dinero apartado aquí. No afecta el patrimonio.',
                'Eliminar',
              ))
            )
              return;
            await run(async () => {
              await api.post(
                '/comandos/EliminarAsignacion',
                { asignacionId, motivo: motivo.trim() },
                token,
              );
              toast.mostrar('Apartado eliminado');
            }, true);
          }}
        />
      </Panel>

      <Button
        title="Historial de cambios"
        variant="secondary"
        onPress={() =>
          nav.go('Historial', {
            entidadTipo: 'ASIGNACION',
            entidadId: asignacionId,
            contexto: asg.nombre,
          })
        }
      />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
  reserva: { gap: 6, borderTopWidth: 1, borderTopColor: c.faint, paddingTop: 8 },
  muted: tipoDe(c).nota,
});
