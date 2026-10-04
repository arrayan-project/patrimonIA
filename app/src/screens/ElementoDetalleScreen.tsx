import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AjustePatrimonialDTO,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
  type ReservaDeElementoDTO,
  type ValorizacionDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { etiquetaNivel } from '../compartirHogar';
import { irAAccion } from './AccionFormScreen';
import {
  AccionDestructiva,
  Button,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  fechaLegible,
  Hero,
  ListCard,
  MenuList,
  MoneyText,
  Nota,
  ProgressBar,
  Screen,
  Section,
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
  const styles = useMemo(() => crearEstilos(), []);
  const { token, usuario } = useSession();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string | undefined;

  const [elemento, setElemento] = useState<ElementoPatrimonialDTO | null>(null);
  const [eventos, setEventos] = useState<EventoFinancieroDTO[]>([]);
  const [valorizaciones, setValorizaciones] = useState<ValorizacionDTO[]>([]);
  const [ajustes, setAjustes] = useState<AjustePatrimonialDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDeElementoDTO[]>([]);
  const [error, setError] = useState('');

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
  const esPropietario = !!elemento?.propietarios.some((p) => p.usuarioId === usuario.id);

  useTitulo(elemento?.nombre);
  useAccionHeader(
    'Editar',
    elemento && esPropietario && elemento.estado !== 'INACTIVO'
      ? () => nav.go('EditarElemento', { elementoId, contexto: elemento.nombre })
      : undefined,
  );

  if (!elemento) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const el = elemento;
  const reservado = reservas.reduce((acc, r) => acc + r.monto, 0);
  const libre = el.valorVigente - reservado;
  const pendiente = el.valorPendiente ?? 0;
  const activo = esPropietario && el.estado !== 'INACTIVO';
  const conInteres = esPropietario && (esDeuda || esCredito) && pendiente > 0;

  const registrarInteres = () =>
    nav.go('RegistrarAjuste', {
      elementoId,
      valorActual: el.valorVigente,
      moneda: el.moneda,
      contexto: el.nombre,
      modoInteres: true,
      sentidoInicial: esDeuda ? 'Menor' : 'Mayor',
      motivoInicial: 'Interés del período',
      magnitudInicial: el.tasaInteres != null ? (pendiente * el.tasaInteres) / 100 / 12 : undefined,
    });
  const registrarValorizacion = () =>
    nav.go('Valorizar', { elementoId, valorActual: el.valorVigente, moneda: el.moneda, contexto: el.nombre });
  const registrarAjuste = () =>
    nav.go('RegistrarAjuste', { elementoId, valorActual: el.valorVigente, moneda: el.moneda, contexto: el.nombre });
  // Secundaria fija: el interés en una deuda o crédito; si no, la valorización.
  const secundaria = conInteres
    ? { title: 'Registrar interés', onPress: registrarInteres }
    : activo && el.admiteValorizacion
      ? { title: 'Registrar valorización', onPress: registrarValorizacion }
      : null;

  // A9 — colapsar el par corrección + original en una sola fila con el monto
  // final; el evento de corrección no se lista aparte.
  const correccionDe = new Map<string, EventoFinancieroDTO>();
  for (const ev of eventos) {
    if (ev.correccionDeId) correccionDe.set(ev.correccionDeId, ev);
  }

  return (
    <Screen
      onRefresh={cargar}
      pie={
        esPropietario && el.estado === 'INACTIVO' ? (
          <Button
            title="Reactivar"
            onPress={() =>
              irAAccion(nav, {
                titulo: 'Reactivar',
                explicacion: 'Vuelve a contar en tu patrimonio.',
                pregunta: '¿Por qué la reactivas?',
                boton: 'Reactivar',
                comando: 'ReactivarElementoPatrimonial',
                body: { elementoId },
                aviso: 'Reactivada',
              })
            }
          />
        ) : activo ? (
          <>
            {/* G32 H-07 — registrar con esta cuenta ya elegida (pagar una deuda = transferir hacia ella). */}
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
            {secundaria && <Button title={secundaria.title} variant="secondary" onPress={secundaria.onPress} />}
          </>
        ) : undefined
      }
    >
      {el.valorOculto ? (
        <Hero label="Valor vigente" value="—" />
      ) : (
        <Hero
          label="Valor vigente"
          value={<MoneyText monto={el.valorVigente} moneda={el.moneda} style={styles.valor} />}
          substats={
            reservado > 0
              ? [
                  { label: 'Libre para gastar', value: money(libre, el.moneda) },
                  { label: 'En metas', value: money(reservado, el.moneda) },
                ]
              : undefined
          }
        />
      )}
      {el.valorOculto ? <Nota>El propietario no comparte el monto de este elemento.</Nota> : null}

      <Datos>
        <Dato etiqueta="Categoría" valor={etiqueta(el.categoriaFuncional)} />
        <Dato etiqueta="Tipo" valor={etiqueta(el.tipo)} />
        <Dato etiqueta="Ámbito" valor={etiqueta(el.ambito)} />
        {esPropietario ? <Dato etiqueta="Con el hogar" valor={etiquetaNivel(el)} /> : null}
        <Dato etiqueta="Estado" valor={etiqueta(el.estado)} />
        {el.fechaAlta ? <Dato etiqueta="En el patrimonio desde" valor={fechaLegible(el.fechaAlta)} /> : null}
        {el.fechaBaja ? <Dato etiqueta="Salió del patrimonio" valor={fechaLegible(el.fechaBaja)} /> : null}
        <Dato
          etiqueta={el.propietarios.length > 1 ? 'Propietarios' : 'Propietario'}
          valor={el.propietarios.map((p) => `${p.nombre ?? p.usuarioId} ${p.porcentaje}%`).join(', ')}
        />
      </Datos>

      {reservas.length > 0 && (
        <Section title="En metas">
          <Nota>
            Sigue en la cuenta, pero lo ahorraste para tus metas. "Libre para gastar" es lo que puedes usar
            sin tocar una meta.
          </Nota>
          <ListCard>
            {reservas.map((r) => (
              <TxRow
                key={r.id}
                title={r.objetivoNombre ? `${r.objetivoNombre} · ${r.asignacionNombre}` : r.asignacionNombre}
                subtitle={r.objetivoNombre ? 'Meta' : 'Ahorro sin meta'}
                amount={money(r.monto, el.moneda)}
                logo={{ icon: 'flag-outline' }}
                onPress={() => nav.go('AsignacionDetalle', { asignacionId: r.asignacionId, contexto: el.nombre })}
              />
            ))}
          </ListCard>
        </Section>
      )}

      {(esDeuda || esCredito) && (
        <Section title={esDeuda ? 'Deuda' : 'Crédito'}>
          <Datos>
            {el.naturaleza === 'CUSTODIA_INFORMAL' && <Dato etiqueta="Tipo" valor="Encargo o custodia" />}
            {el.estadoOperativo && (
              <Dato
                etiqueta="Estado"
                valor={
                  <Text style={[styles.movMonto, { color: colorEstadoDeuda(el.estadoOperativo, c) }]}>
                    {etiqueta(el.estadoOperativo)}
                  </Text>
                }
              />
            )}
            <Dato etiqueta="Saldo pendiente" valor={money(pendiente, el.moneda)} />
            {el.contraparte ? <Dato etiqueta={esDeuda ? 'Acreedor' : 'Deudor'} valor={el.contraparte} /> : null}
            {el.fechaInicio ? <Dato etiqueta="Desde" valor={fechaLegible(el.fechaInicio)} /> : null}
            {el.fechaTermino ? <Dato etiqueta="Vence" valor={fechaLegible(el.fechaTermino)} /> : null}
            {el.cuotaMonto != null ? <Dato etiqueta="Cuota" valor={money(el.cuotaMonto, el.moneda)} /> : null}
            {el.tasaInteres != null ? <Dato etiqueta="Tasa anual" valor={`${el.tasaInteres}%`} /> : null}
          </Datos>
          {el.valorPendienteInicial != null && el.valorPendienteInicial > 0 && (
            <>
              <ProgressBar pct={((el.valorPendienteInicial - pendiente) / el.valorPendienteInicial) * 100} />
              <Nota>
                Pagado {money(el.valorPendienteInicial - pendiente, el.moneda)} de{' '}
                {money(el.valorPendienteInicial, el.moneda)}
              </Nota>
            </>
          )}
          {el.observaciones ? <Nota>{el.observaciones}</Nota> : null}
          {conInteres && <Nota>El interés del período se registra como un ajuste que aumenta el saldo.</Nota>}
        </Section>
      )}

      <Section title="Movimientos">
        {eventos.length === 0 ? (
          <Nota>Sin movimientos.</Nota>
        ) : (
          <ListCard>
            {eventos
              .filter((ev) => !ev.correccionDeId)
              .map((ev) => {
                const impacto = ev.impactos.find((i) => i.elementoId === elementoId);
                const corr = correccionDe.get(ev.id);
                const corrImpacto = corr?.impactos.find((i) => i.elementoId === elementoId);
                const monto = (impacto?.monto ?? ev.monto) + (corr ? (corrImpacto?.monto ?? 0) : 0);
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
                      nav.go('MovimientoDetalle', { eventoId: ev.id, elementoId, contexto: el.nombre })
                    }
                  />
                );
              })}
          </ListCard>
        )}
      </Section>

      {el.admiteValorizacion && (
        <Section
          title="Valorizaciones"
          accion="Registrar"
          onAccion={activo && secundaria?.title !== 'Registrar valorización' ? registrarValorizacion : undefined}
        >
          {valorizaciones.length === 0 ? (
            <Nota>Sin valorizaciones.</Nota>
          ) : (
            <ListCard>
              {valorizaciones.map((v) => (
                <TxRow
                  key={v.id}
                  title={fechaLegible(v.fecha)}
                  subtitle={v.anulada ? 'eliminada' : v.correccionDeId ? 'corrección' : undefined}
                  amount={money(v.valorNuevo, el.moneda)}
                  logo={{ icon: 'trending-up-outline' }}
                  onPress={() =>
                    nav.go('ValorizacionDetalle', {
                      valorizacionId: v.id,
                      elementoId,
                      moneda: el.moneda,
                      contexto: el.nombre,
                    })
                  }
                />
              ))}
            </ListCard>
          )}
        </Section>
      )}

      <Section title="Ajustes patrimoniales" accion="Registrar" onAccion={activo ? registrarAjuste : undefined}>
        {ajustes.length === 0 ? (
          <Nota>Sin ajustes.</Nota>
        ) : (
          <ListCard>
            {ajustes.map((a) => (
              <TxRow
                key={a.id}
                title={a.motivo}
                subtitle={`${fechaLegible(a.fecha)}${a.anulado ? ' · eliminado' : a.correccionDeId ? ' · corrección' : ''}`}
                amount={`${a.monto > 0 ? '+' : a.monto < 0 ? '−' : ''}${money(Math.abs(a.monto), el.moneda)}`}
                positivo={!a.anulado && a.monto > 0}
                logo={{ icon: 'construct-outline' }}
                onPress={() =>
                  nav.go('AjusteDetalle', { ajusteId: a.id, elementoId, moneda: el.moneda, contexto: el.nombre })
                }
              />
            ))}
          </ListCard>
        )}
      </Section>

      {esPropietario && (
        <MenuList
          items={[
            ...(activo
              ? [
                  {
                    title: 'Ajustes de la cuenta',
                    subtitle: `Con el hogar: ${etiquetaNivel(el).toLowerCase()}`,
                    icon: 'options-outline' as const,
                    onPress: () => nav.go('AjustesElemento', { elementoId }),
                  },
                ]
              : []),
            {
              title: '¿Cuánto valía en otra fecha?',
              icon: 'calendar-outline',
              onPress: () => nav.go('ValorEnFecha', { elementoId }),
            },
            {
              title: 'Historial de cambios',
              icon: 'time-outline',
              onPress: () =>
                nav.go('Historial', { entidadTipo: 'ELEMENTO_PATRIMONIAL', entidadId: elementoId, contexto: el.nombre }),
            },
          ]}
        />
      )}

      <ErrorText>{error}</ErrorText>
      {activo && (
        <AccionDestructiva
          title="Desactivar"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Desactivar',
              explicacion: 'Deja de contar en tu patrimonio desde la fecha de salida. Se puede reactivar después.',
              pregunta: '¿Por qué? (opcional)',
              minimo: 0,
              fecha: { campo: 'fechaBaja', pregunta: '¿Desde cuándo? (opcional, por defecto hoy)' },
              boton: 'Desactivar',
              comando: 'DesactivarElementoPatrimonial',
              body: { elementoId },
              aviso: 'Desactivada',
              peligro: true,
            })
          }
        />
      )}
      {/* Eliminar solo si nunca tuvo movimientos ni valorizaciones; si no, se desactiva. */}
      {esPropietario && eventos.length === 0 && valorizaciones.length === 0 && (
        <AccionDestructiva
          title="Eliminar"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar',
              explicacion: 'Se borra para siempre. Solo es posible porque nunca tuvo movimientos ni valorizaciones.',
              pregunta: '¿Por qué la eliminas?',
              boton: 'Eliminar',
              comando: 'EliminarElementoPatrimonial',
              body: { elementoId },
              campo: 'justificacion',
              aviso: 'Eliminada',
              peligro: true,
              volver: 2,
            })
          }
        />
      )}
      {esPropietario && (esDeuda || esCredito) && pendiente > 0 && (
        <AccionDestructiva
          title={esDeuda ? 'Condonar deuda' : 'Declarar incobrable'}
          onPress={() =>
            irAAccion(nav, {
              titulo: esDeuda ? 'Condonar deuda' : 'Declarar incobrable',
              explicacion: esDeuda
                ? 'El acreedor perdona el saldo: queda en cero y tu patrimonio sube. No se puede deshacer.'
                : 'Reconoces que no se recuperará: el saldo queda en cero y tu patrimonio baja. No se puede deshacer.',
              pregunta: '¿Por qué?',
              boton: esDeuda ? 'Condonar deuda' : 'Declarar incobrable',
              comando: esDeuda ? 'CondonarDeuda' : 'DeclararIncobrable',
              body: { elementoId },
              aviso: esDeuda ? 'Deuda condonada' : 'Crédito incobrable',
              peligro: true,
            })
          }
        />
      )}
    </Screen>
  );
}

const crearEstilos = () => StyleSheet.create({
  valor: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  movMonto: { fontSize: 15, fontWeight: '700' },
});
