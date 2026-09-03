import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { Button, colors, ErrorText, Field, fechaLegible, Row, Screen, Title } from '../ui';

export function ElementoDetalleScreen() {
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
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <Title>{elemento.nombre}</Title>
      <Text style={styles.valor}>{money(elemento.valorVigente, elemento.moneda)}</Text>

      <View style={styles.card}>
        <Row left="Categoría" right={elemento.categoriaFuncional} />
        <Row left="Tipo" right={elemento.tipo} />
        <Row left="Ámbito" right={elemento.ambito} />
        <Row left="Visibilidad" right={elemento.visibilidad} />
        <Row left="Estado" right={elemento.estado} />
      </View>

      {(esDeuda || esCredito) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{esDeuda ? 'Deuda' : 'Crédito'}</Text>
          <Row
            left="Saldo pendiente"
            right={money(elemento.valorPendiente ?? 0, elemento.moneda)}
          />
          {(elemento.valorPendiente ?? 0) > 0 ? (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Text style={styles.muted}>
                {esDeuda
                  ? 'Condonar: el acreedor perdona el saldo (tu patrimonio sube).'
                  : 'Declarar incobrable: reconoces que no se recuperará (tu patrimonio baja).'}
              </Text>
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
            <Text style={styles.muted}>Saldada.</Text>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Propietarios</Text>
        {elemento.propietarios.map((p) => (
          <Row key={p.usuarioId} left={p.nombre ?? p.usuarioId} right={`${p.porcentaje}%`} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Movimientos</Text>
        {eventos.length === 0 ? (
          <Text style={styles.muted}>Sin movimientos.</Text>
        ) : (
          eventos.map((ev) => {
            const impacto = ev.impactos.find((i) => i.elementoId === elementoId);
            const etiqueta = ev.anulado
              ? 'anulado'
              : ev.correccionDeId
                ? 'corrección'
                : fechaLegible(ev.fecha);
            return (
              <Pressable
                key={ev.id}
                style={styles.mov}
                onPress={() =>
                  nav.go('MovimientoDetalle', { eventoId: ev.id, elementoId })
                }
              >
                <View>
                  <Text style={[styles.movTipo, ev.anulado && styles.tachado]}>
                    {ev.glosa || ev.tipo}
                  </Text>
                  <Text style={styles.muted}>{ev.glosa ? `${ev.tipo} · ${etiqueta}` : etiqueta}</Text>
                </View>
                <Text
                  style={[
                    styles.movMonto,
                    ev.anulado
                      ? styles.tachado
                      : { color: (impacto?.monto ?? 0) < 0 ? colors.danger : colors.primary },
                  ]}
                >
                  {money(impacto?.monto ?? ev.monto, ev.moneda)}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      {elemento.admiteValorizacion && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Valorizaciones</Text>
          {valorizaciones.length === 0 ? (
            <Text style={styles.muted}>Sin valorizaciones.</Text>
          ) : (
            valorizaciones.map((v) => (
              <Pressable
                key={v.id}
                style={styles.mov}
                onPress={() =>
                  nav.go('ValorizacionDetalle', {
                    valorizacionId: v.id,
                    elementoId,
                    moneda: elemento.moneda,
                  })
                }
              >
                <Text style={[styles.muted, v.anulada && styles.tachado]}>
                  {v.anulada ? 'anulada' : v.correccionDeId ? 'corrección' : fechaLegible(v.fecha)}
                </Text>
                <Text style={[styles.movMonto, v.anulada && styles.tachado]}>
                  {money(v.valorNuevo, elemento.moneda)}
                </Text>
              </Pressable>
            ))
          )}
          <View style={{ marginTop: 8 }}>
            <Button
              title="Registrar valorización"
              variant="secondary"
              onPress={() =>
                nav.go('Valorizar', {
                  elementoId,
                  valorActual: elemento.valorVigente,
                  moneda: elemento.moneda,
                })
              }
            />
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ajustes patrimoniales</Text>
        {ajustes.length === 0 ? (
          <Text style={styles.muted}>Sin ajustes.</Text>
        ) : (
          ajustes.map((a) => (
            <Pressable
              key={a.id}
              style={styles.mov}
              onPress={() =>
                nav.go('AjusteDetalle', { ajusteId: a.id, elementoId, moneda: elemento.moneda })
              }
            >
              <Text style={[styles.muted, a.anulado && styles.tachado]}>
                {a.anulado ? 'anulado' : a.correccionDeId ? 'corrección' : a.motivo}
              </Text>
              <Text style={[styles.movMonto, a.anulado && styles.tachado]}>
                {money(a.monto, elemento.moneda)}
              </Text>
            </Pressable>
          ))
        )}
        <View style={{ marginTop: 8 }}>
          <Button
            title="Registrar ajuste"
            variant="secondary"
            onPress={() =>
              nav.go('RegistrarAjuste', {
                elementoId,
                valorActual: elemento.valorVigente,
                moneda: elemento.moneda,
              })
            }
          />
        </View>
      </View>

      <ErrorText>{error}</ErrorText>
      <Button
        title="Editar / estado"
        variant="secondary"
        onPress={() => nav.go('EditarElemento', { elementoId })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  valor: { fontSize: 28, fontWeight: '800', color: colors.text },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 13, color: colors.muted },
  mov: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.faint,
    paddingVertical: 10,
  },
  movTipo: { fontSize: 14, fontWeight: '600', color: colors.text },
  movMonto: { fontSize: 15, fontWeight: '700' },
  tachado: { textDecorationLine: 'line-through', color: colors.muted },
});
