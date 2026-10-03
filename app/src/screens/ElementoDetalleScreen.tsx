import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AjustePatrimonialDTO,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
  type ReservaDeElementoDTO,
  type ValorHistoricoElementoDTO,
  type ValorizacionDTO,
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
  Hero,
  ListItem,
  MoneyText,
  Nota,
  Panel,
  ProgressBar,
  Row,
  Screen,
  SectionTitle,
  Skeleton,
  TxRow,
  useC,
  type Paleta,
} from '../ui';

/** Color del estado operativo de una deuda/crédito (§B2). */
function colorEstadoDeuda(estado: string, c: Paleta): string {
  if (estado === 'EN_MORA' || estado === 'INCOBRABLE') return c.danger;
  if (estado === 'PARCIALMENTE_PAGADA' || estado === 'SALDADA') return c.primary;
  return c.muted;
}

export function ElementoDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string | undefined;

  const [elemento, setElemento] = useState<ElementoPatrimonialDTO | null>(null);
  const [eventos, setEventos] = useState<EventoFinancieroDTO[]>([]);
  const [valorizaciones, setValorizaciones] = useState<ValorizacionDTO[]>([]);
  const [ajustes, setAjustes] = useState<AjustePatrimonialDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDeElementoDTO[]>([]);
  const [error, setError] = useState('');
  const [saldarMotivo, setSaldarMotivo] = useState('');
  const [saldando, setSaldando] = useState(false);
  const [fechaHist, setFechaHist] = useState('');
  const [valorHist, setValorHist] = useState<ValorHistoricoElementoDTO | null>(null);
  const [histBusy, setHistBusy] = useState(false);

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
        await api
          .get<EventoFinancieroDTO[]>(`/eventos-financieros?elemento=${elementoId}`, token)
          .catch(() => []),
      );
      setAjustes(
        await api
          .get<AjustePatrimonialDTO[]>(`/ajustes-patrimoniales?elemento=${elementoId}`, token)
          .catch(() => []),
      );
      setReservas(
        await api
          .get<ReservaDeElementoDTO[]>(`/elementos-patrimoniales/${elementoId}/reservas`, token)
          .catch(() => []),
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

  const consultarHistorico = async () => {
    setHistBusy(true);
    setError('');
    try {
      setValorHist(
        await api.get<ValorHistoricoElementoDTO>(
          `/elementos-patrimoniales/${elementoId}/valor-historico?fecha=${fechaHist.trim()}`,
          token,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setHistBusy(false);
    }
  };

  const el = elemento;
  const esPropietario = el.propietarios.some((p) => p.usuarioId === usuario.id);
  const reservado = reservas.reduce((acc, r) => acc + r.monto, 0);
  const libre = el.valorVigente - reservado;
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
      {el.valorOculto ? (
        <Hero label={el.nombre} value="—" />
      ) : (
        <Hero
          label={`${el.nombre} · valor vigente`}
          value={<MoneyText monto={el.valorVigente} moneda={el.moneda} style={styles.valor} />}
        />
      )}
      {el.valorOculto ? (
        <Nota>El propietario no comparte el monto de este elemento.</Nota>
      ) : null}

      <Panel>
        <Row left="Categoría" right={etiqueta(el.categoriaFuncional)} />
        <Row left="Tipo" right={etiqueta(el.tipo)} />
        <Row left="Ámbito" right={etiqueta(el.ambito)} />
        <Row left="Visibilidad" right={etiqueta(el.visibilidad)} />
        <Row left="Estado" right={etiqueta(el.estado)} />
        {el.fechaAlta ? <Row left="En el patrimonio desde" right={fechaLegible(el.fechaAlta)} /> : null}
        {el.fechaBaja ? <Row left="Salió del patrimonio" right={fechaLegible(el.fechaBaja)} /> : null}
      </Panel>

      {/* G32 H-07 — registrar con esta cuenta ya elegida (pagar una deuda = transferir hacia ella). */}
      {esPropietario && el.estado !== 'INACTIVO' && (
        <Button
          title={esDeuda ? 'Registrar pago' : esCredito ? 'Registrar cobro' : 'Registrar movimiento'}
          onPress={() =>
            nav.go(
              'RegistrarMovimiento',
              esDeuda
                ? { tipo: 'TRANSFERENCIA', destinoId: elementoId }
                : esCredito
                  ? { tipo: 'TRANSFERENCIA', origenId: elementoId }
                  : { cuentaId: elementoId },
            )
          }
        />
      )}

      {reservas.length > 0 && (
        <Panel>
          <SectionTitle>Libre para gastar</SectionTitle>
          <Row left="Valor vigente" right={money(el.valorVigente, el.moneda)} />
          <Row left="En metas" right={`− ${money(reservado, el.moneda)}`} />
          <Row left="Libre para gastar" right={money(libre, el.moneda)} />
          <Nota>
            Lo que está en metas no salió de la cuenta: sigue ahí, pero lo ahorraste
            para tus metas. "Libre para gastar" es lo que puedes usar sin tocar una meta.
          </Nota>
          {reservas.map((r) => (
            <ListItem
              key={r.id}
              title={r.objetivoNombre ? `${r.objetivoNombre} · ${r.asignacionNombre}` : r.asignacionNombre}
              subtitle={r.objetivoNombre ? 'Meta' : 'Ahorro sin meta'}
              right={money(r.monto, el.moneda)}
              onPress={() =>
                nav.go('AsignacionDetalle', { asignacionId: r.asignacionId, contexto: el.nombre })
              }
            />
          ))}
        </Panel>
      )}

      {(esDeuda || esCredito) && (
        <Panel>
          <SectionTitle>{esDeuda ? 'Deuda' : 'Crédito'}</SectionTitle>
          {el.naturaleza === 'CUSTODIA_INFORMAL' && (
            <Row
              left="Tipo"
              right={
                <Text style={[styles.movMonto, { color: c.muted }]}>Encargo o custodia</Text>
              }
            />
          )}
          {el.estadoOperativo && (
            <Row
              left="Estado"
              right={
                <Text style={[styles.movMonto, { color: colorEstadoDeuda(el.estadoOperativo, c) }]}>
                  {etiqueta(el.estadoOperativo)}
                </Text>
              }
            />
          )}
          <Row left="Saldo pendiente" right={money(el.valorPendiente ?? 0, el.moneda)} />
          {el.valorPendienteInicial != null && el.valorPendienteInicial > 0 && (
            <View style={{ gap: 4 }}>
              <ProgressBar
                pct={
                  ((el.valorPendienteInicial - (el.valorPendiente ?? 0)) / el.valorPendienteInicial) *
                  100
                }
              />
              <Nota>
                Pagado {money(el.valorPendienteInicial - (el.valorPendiente ?? 0), el.moneda)} de{' '}
                {money(el.valorPendienteInicial, el.moneda)}
              </Nota>
            </View>
          )}
          {el.contraparte ? (
            <Row left={esDeuda ? 'Acreedor' : 'Deudor'} right={el.contraparte} />
          ) : null}
          {el.fechaInicio ? <Row left="Desde" right={fechaLegible(el.fechaInicio)} /> : null}
          {el.fechaTermino ? <Row left="Vence" right={fechaLegible(el.fechaTermino)} /> : null}
          {el.cuotaMonto != null ? (
            <Row left="Cuota" right={money(el.cuotaMonto, el.moneda)} />
          ) : null}
          {el.tasaInteres != null ? <Row left="Tasa anual" right={`${el.tasaInteres}%`} /> : null}
          {el.observaciones ? <Nota>{el.observaciones}</Nota> : null}
          {esPropietario && (el.valorPendiente ?? 0) > 0 && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <Nota>
                El interés del período se registra como un ajuste que aumenta el saldo.
              </Nota>
              <Button
                title="Registrar interés"
                variant="secondary"
                onPress={() =>
                  nav.go('RegistrarAjuste', {
                    elementoId,
                    valorActual: el.valorVigente,
                    moneda: el.moneda,
                    contexto: el.nombre,
                    modoInteres: true,
                    sentidoInicial: esDeuda ? 'Menor' : 'Mayor',
                    motivoInicial: 'Interés del período',
                    magnitudInicial:
                      el.tasaInteres != null
                        ? ((el.valorPendiente ?? 0) * el.tasaInteres) / 100 / 12
                        : undefined,
                  })
                }
              />
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
          (() => {
            // A9 — colapsar el par corrección + original en una sola fila con el
            // monto final; el evento de corrección no se lista aparte.
            const correccionDe = new Map<string, EventoFinancieroDTO>();
            for (const ev of eventos) {
              if (ev.correccionDeId) correccionDe.set(ev.correccionDeId, ev);
            }
            return eventos
              .filter((ev) => !ev.correccionDeId)
              .map((ev) => {
                const impacto = ev.impactos.find((i) => i.elementoId === elementoId);
                const corr = correccionDe.get(ev.id);
                const corrImpacto = corr?.impactos.find((i) => i.elementoId === elementoId);
                const monto =
                  (impacto?.monto ?? ev.monto) + (corr ? (corrImpacto?.monto ?? 0) : 0);
                const sufijo = ev.anulado
                  ? 'eliminado'
                  : corr
                    ? `corregido · ${fechaLegible(ev.fecha)}`
                    : fechaLegible(ev.fecha);
                return (
                  <TxRow
                    key={ev.id}
                    title={ev.glosa || etiqueta(ev.tipo)}
                    subtitle={ev.glosa ? `${etiqueta(ev.tipo)} · ${sufijo}` : sufijo}
                    amount={`${monto < 0 ? '−' : monto > 0 ? '+' : ''}${money(Math.abs(monto), ev.moneda)}`}
                    positivo={!ev.anulado && monto > 0}
                    logo={{
                      icon:
                        ev.tipo === 'INGRESO'
                          ? 'arrow-down-outline'
                          : ev.tipo === 'GASTO'
                            ? 'arrow-up-outline'
                            : 'swap-horizontal-outline',
                    }}
                    onPress={() =>
                      nav.go('MovimientoDetalle', {
                        eventoId: ev.id,
                        elementoId,
                        contexto: el.nombre,
                      })
                    }
                  />
                );
              });
          })()
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
                title={v.anulada ? 'eliminada' : v.correccionDeId ? 'corrección' : fechaLegible(v.fecha)}
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
              title={a.anulado ? 'eliminado' : a.correccionDeId ? 'corrección' : a.motivo}
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

      {esPropietario && (
        <Panel>
          <SectionTitle>Valor a una fecha</SectionTitle>
          <Nota>Reconstruye cuánto valía este elemento en una fecha pasada.</Nota>
          <DateField label="Fecha" value={fechaHist} onChange={setFechaHist} />
          <Button
            title="Consultar"
            variant="secondary"
            loading={histBusy}
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(fechaHist.trim())}
            onPress={consultarHistorico}
          />
          {valorHist &&
            (valorHist.existia ? (
              <Row
                left={`Al ${fechaLegible(valorHist.fecha)}`}
                right={money(valorHist.valor, valorHist.moneda)}
              />
            ) : (
              <Nota>En esa fecha el elemento aún no existía o ya había salido del patrimonio.</Nota>
            ))}
        </Panel>
      )}

      <ErrorText>{error}</ErrorText>
      {esPropietario && (
        <>
          <Button
            title="Editar / estado"
            variant="secondary"
            onPress={() => nav.go('EditarElemento', { elementoId, contexto: el.nombre })}
          />
          <Button
            title="Historial de cambios"
            variant="secondary"
            onPress={() =>
              nav.go('Historial', {
                entidadTipo: 'ELEMENTO_PATRIMONIAL',
                entidadId: elementoId,
                contexto: el.nombre,
              })
            }
          />
        </>
      )}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  valor: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  movMonto: { fontSize: 15, fontWeight: '700' },
  tachado: { textDecorationLine: 'line-through', color: c.muted },
});
