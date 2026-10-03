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
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { GLOSARIO } from '../labels';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos } from '../opciones';
import {
  Elegir,
  Ayuda,
  Button,
  ErrorText,
  Field,
  LinkButton,
  Migaja,
  MoneyField,
  Row,
  Screen,
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

  useTitulo(asg?.nombre);

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
  // D-4: un ahorro sin meta ya no recibe plata nueva; solo se saca o se elimina.
  const deUnaMeta = !!asg.objetivoId;

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Text style={styles.muted}>Ahorrado: {money(asg.totalReservado, asg.moneda)}</Text>

      <Ayuda>{GLOSARIO.apartado}</Ayuda>

      <Panel>
        <Text style={styles.sectionTitle}>En qué cuentas está</Text>
        {reservasActivas.length === 0 ? (
          <Text style={styles.muted}>Aún no ahorras aquí.</Text>
        ) : (
          reservasActivas.map((r) => (
            <View key={r.id} style={styles.reserva}>
              <Row
                left={nombrePorId.get(r.elementoOrigenId) ?? 'Cuenta'}
                right={money(r.monto, asg.moneda)}
              />
              <Button
                title={deUnaMeta ? 'Sacar de la meta' : 'Sacar'}
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

      {deUnaMeta && (
      <Panel>
        <Text style={styles.sectionTitle}>Ahorrar más</Text>
        <Elegir
          label="Desde qué cuenta"
          placeholder="Elegir cuenta"
          value={origenId}
          options={opcionesDeElementos(elementos)}
          onChange={setOrigenId}
        />
        <MoneyField label="¿Cuánto?" value={monto} onChange={setMonto} />
        <Button
          title="Ahorrar"
          loading={busy}
          disabled={!origenId || !(Number(monto) > 0)}
          onPress={() =>
            run(async () => {
              await api.post(
                '/comandos/CrearReserva',
                { asignacionId, elementoOrigenId: origenId, monto: Number(monto) },
                token,
              );
              toast.mostrar('Ahorro registrado');
              setMonto('');
              setOrigenId(null);
            })
          }
        />
      </Panel>
      )}

      <Panel>
        <Field label="Motivo (para sacar o eliminar)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        <Button
          title={deUnaMeta ? 'Eliminar esta parte' : 'Eliminar este ahorro'}
          variant="danger"
          loading={busy}
          disabled={motivo.trim().length < 3}
          onPress={async () => {
            if (
              !(await confirmar(
                deUnaMeta ? 'Eliminar esta parte' : 'Eliminar este ahorro',
                'Toda la plata ahorrada aquí vuelve a quedar libre para gastar. No sale de tus cuentas.',
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
              toast.mostrar('Ahorro eliminado');
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
