import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AjustePatrimonialDTO,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
  type ValorizacionDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Button,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  ListItem,
  MoneyText,
  Nota,
  Panel,
  Row,
  Screen,
  SectionTitle,
  Skeleton,
  Stat,
  Title,
  useC,
  type Paleta,
} from '../ui';

export function ElementoDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string | undefined;

  const [elemento, setElemento] = useState<ElementoPatrimonialDTO | null>(null);
  const [eventos, setEventos] = useState<EventoFinancieroDTO[]>([]);
  const [valorizaciones, setValorizaciones] = useState<ValorizacionDTO[]>([]);
  const [ajustes, setAjustes] = useState<AjustePatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [saldarMotivo, setSaldarMotivo] = useState('');
  const [saldando, setSaldando] = useState(false);

  const cargar = useCallback(async () => {
    if (!elementoId) return;
    setError('');
    try {
      const el = await api.get<ElementoPatrimonialDTO>(
        `/elementos-patrimoniales/${elementoId}`,
        token,
      );
      setElemento(el);
      setEventos(
        await api.get<EventoFinancieroDTO[]>(`/eventos-financieros?elemento=${elementoId}`, token),
      );
      setAjustes(
        await api.get<AjustePatrimonialDTO[]>(`/ajustes-patrimoniales?elemento=${elementoId}`, token),
      );
      if (el.admiteValorizacion) {
        setValorizaciones(
          await api.get<ValorizacionDTO[]>(
            `/elementos-patrimoniales/${elementoId}/valorizaciones`,
            token,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, token]);

  useCargaAlEnfocar(cargar);

  const esDeuda = elemento?.categoriaFuncional === 'DEUDA';
  const esCredito = elemento?.categoriaFuncional === 'CREDITO';

  const saldar = async () => {
    const ok = await confirmar(
      esDeuda ? 'Condonar deuda' : 'Declarar incobrable',
      esDeuda
        ? 'El saldo pendiente se lleva a cero y tu patrimonio sube. No se puede deshacer.'
        : 'El saldo pendiente se lleva a cero y tu patrimonio baja. No se puede deshacer.',
      esDeuda ? 'Condonar' : 'Declarar incobrable',
    );
    if (!ok) return;
    setSaldando(true);
    setError('');
    try {
      await api.post(
        esDeuda ? '/comandos/CondonarDeuda' : '/comandos/DeclararIncobrable',
        { elementoId, motivo: saldarMotivo.trim() },
        token,
      );
      toast.mostrar(esDeuda ? 'Deuda condonada' : 'Crédito incobrable');
      setSaldarMotivo('');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setSaldando(false);
    }
  };

  if (!elemento) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const el = elemento;
  const montoMov = (monto: number, moneda: string, anulado: boolean) => (
    <Text
      style={[
        styles.movMonto,
        anulado ? styles.tachado : { color: monto < 0 ? c.danger : c.primary },
      ]}
    >
      {money(monto, moneda)}
    </Text>
  );

  return (
    <Screen onRefresh={cargar}>
      <Title>{el.nombre}</Title>
      <Stat
        label="Valor vigente"
        value={<MoneyText monto={el.valorVigente} moneda={el.moneda} style={styles.valor} />}
      />

      <Panel>
        <Row left="Categoría" right={etiqueta(el.categoriaFuncional)} />
        <Row left="Tipo" right={etiqueta(el.tipo)} />
        <Row left="Ámbito" right={etiqueta(el.ambito)} />
        <Row left="Visibilidad" right={etiqueta(el.visibilidad)} />
        <Row left="Estado" right={etiqueta(el.estado)} />
      </Panel>

      {(esDeuda || esCredito) && (
        <Panel>
          <SectionTitle>{esDeuda ? 'Deuda' : 'Crédito'}</SectionTitle>
          <Row left="Saldo pendiente" right={money(el.valorPendiente ?? 0, el.moneda)} />
          {(el.valorPendiente ?? 0) > 0 ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Nota>
                {esDeuda
                  ? 'Condonar: el acreedor perdona el saldo (tu patrimonio sube).'
                  : 'Declarar incobrable: reconoces que no se recuperará (tu patrimonio baja).'}
              </Nota>
              <Field label="Motivo" value={saldarMotivo} onChangeText={setSaldarMotivo} autoCapitalize="sentences" />
              <Button
                title={esDeuda ? 'Condonar deuda' : 'Declarar incobrable'}
                variant="danger"
                onPress={saldar}
                loading={saldando}
                disabled={saldarMotivo.trim().length < 3}
              />
            </View>
          ) : (
            <Nota>Saldada.</Nota>
          )}
        </Panel>
      )}

      <Panel>
        <SectionTitle>Propietarios</SectionTitle>
        {el.propietarios.map((p) => (
          <Row key={p.usuarioId} left={p.nombre ?? p.usuarioId} right={`${p.porcentaje}%`} />
        ))}
      </Panel>

      <Panel>
        <SectionTitle>Movimientos</SectionTitle>
        {eventos.length === 0 ? (
          <Nota>Sin movimientos.</Nota>
        ) : (
          eventos.map((ev) => {
            const impacto = ev.impactos.find((i) => i.elementoId === elementoId);
            const sufijo = ev.anulado
              ? 'anulado'
              : ev.correccionDeId
                ? 'corrección'
                : fechaLegible(ev.fecha);
            return (
              <ListItem
                key={ev.id}
                title={ev.glosa || etiqueta(ev.tipo)}
                subtitle={ev.glosa ? `${etiqueta(ev.tipo)} · ${sufijo}` : sufijo}
                tachado={ev.anulado}
                right={montoMov(impacto?.monto ?? ev.monto, ev.moneda, ev.anulado)}
                onPress={() =>
                  nav.go('MovimientoDetalle', {
                    eventoId: ev.id,
                    elementoId,
                    contexto: el.nombre,
                  })
                }
              />
            );
          })
        )}
      </Panel>

      {el.admiteValorizacion && (
        <Panel>
          <SectionTitle>Valorizaciones</SectionTitle>
          {valorizaciones.length === 0 ? (
            <Nota>Sin valorizaciones.</Nota>
          ) : (
            valorizaciones.map((v) => (
              <ListItem
                key={v.id}
                title={v.anulada ? 'anulada' : v.correccionDeId ? 'corrección' : fechaLegible(v.fecha)}
                tachado={v.anulada}
                right={
                  <Text style={[styles.movMonto, v.anulada && styles.tachado]}>
                    {money(v.valorNuevo, el.moneda)}
                  </Text>
                }
                onPress={() =>
                  nav.go('ValorizacionDetalle', {
                    valorizacionId: v.id,
                    elementoId,
                    moneda: el.moneda,
                    contexto: el.nombre,
                  })
                }
              />
            ))
          )}
          <View style={{ marginTop: 8 }}>
            <Button
              title="Registrar valorización"
              variant="secondary"
              onPress={() =>
                nav.go('Valorizar', {
                  elementoId,
                  valorActual: el.valorVigente,
                  moneda: el.moneda,
                  contexto: el.nombre,
                })
              }
            />
          </View>
        </Panel>
      )}

      <Panel>
        <SectionTitle>Ajustes patrimoniales</SectionTitle>
        {ajustes.length === 0 ? (
          <Nota>Sin ajustes.</Nota>
        ) : (
          ajustes.map((a) => (
            <ListItem
              key={a.id}
              title={a.anulado ? 'anulado' : a.correccionDeId ? 'corrección' : a.motivo}
              tachado={a.anulado}
              right={
                a.anulado ? (
                  <Text style={[styles.movMonto, styles.tachado]}>{money(a.monto, el.moneda)}</Text>
                ) : (
                  <MoneyText monto={a.monto} moneda={el.moneda} style={styles.movMonto} />
                )
              }
              onPress={() =>
                nav.go('AjusteDetalle', {
                  ajusteId: a.id,
                  elementoId,
                  moneda: el.moneda,
                  contexto: el.nombre,
                })
              }
            />
          ))
        )}
        <View style={{ marginTop: 8 }}>
          <Button
            title="Registrar ajuste"
            variant="secondary"
            onPress={() =>
              nav.go('RegistrarAjuste', {
                elementoId,
                valorActual: el.valorVigente,
                moneda: el.moneda,
                contexto: el.nombre,
              })
            }
          />
        </View>
      </Panel>

      <ErrorText>{error}</ErrorText>
      <Button
        title="Editar / estado"
        variant="secondary"
        onPress={() => nav.go('EditarElemento', { elementoId, contexto: el.nombre })}
      />
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  valor: { fontSize: 28, fontWeight: '800' },
  movMonto: { fontSize: 15, fontWeight: '700' },
  tachado: { textDecorationLine: 'line-through', color: c.muted },
});
