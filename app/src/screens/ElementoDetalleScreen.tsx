import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AjustePatrimonialDTO,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type EventoFinancieroDTO,
  type HogarDTO,
  type ReservaDeElementoDTO,
  type ValorizacionDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { etiquetaNivel } from '../compartirHogar';
import { emojiCategoria, emojiElemento, emojiMeta, emojiTipoMovimiento } from '../emojis';
import { usePreferencias } from '../preferencias';
import { irAAccion } from './AccionFormScreen';
import {
  AvisoDetalle,
  BandaDetalle,
  Button,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  fechaLegible,
  ListCard,
  MenuList,
  Nota,
  Panel,
  ProgressBar,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
} from '../ui';

/** Movimientos a la vista antes de "Ver todos". */
const MOVS_VISIBLES = 5;
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Estado de una deuda o crédito, solo cuando dice algo (§B2). */
const ESTADO_DEUDA: Record<string, string> = {
  EN_MORA: '⏰ En mora',
  SALDADA: '✅ Pagada',
  CONDONADA: '🤝 Condonada',
  INCOBRABLE: '❌ Incobrable',
};

type CambioValor =
  | { clase: 'valorizacion'; fecha: string; v: ValorizacionDTO }
  | { clase: 'ajuste'; fecha: string; a: AjustePatrimonialDTO };

/**
 * Detalle de una cuenta o bien (G35): una banda con cuánto tiene (o debe, o
 * vale) y, si hay metas, la resta hasta "Puedes gastar"; los datos de la
 * deuda; sus movimientos; los cambios de valor (valorizaciones y correcciones
 * de saldo juntas, por fecha); todas las acciones en una lista y, al final,
 * las que no se deshacen.
 */
export function ElementoDetalleScreen() {
  const c = useC();
  const { token, usuario } = useSession();
  const { preferencias } = usePreferencias();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string | undefined;

  const [elemento, setElemento] = useState<ElementoPatrimonialDTO | null>(null);
  const [eventos, setEventos] = useState<EventoFinancieroDTO[]>([]);
  const [valorizaciones, setValorizaciones] = useState<ValorizacionDTO[]>([]);
  const [ajustes, setAjustes] = useState<AjustePatrimonialDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDeElementoDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [verTodos, setVerTodos] = useState(false);
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
      // G35: las categorías, para el emoji de cada movimiento.
      const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => [] as HogarDTO[]);
      if (hs[0])
        setCategorias(
          await api
            .get<CategoriaMovimientoDTO[]>(`/hogares/${hs[0].id}/categorias-movimiento?incluirArchivadas=true`, token)
            .catch(() => []),
        );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, token]);

  useCargaAlEnfocar(cargar);

  const esDeuda = elemento?.categoriaFuncional === 'DEUDA';
  const esCredito = elemento?.categoriaFuncional === 'CREDITO';
  const esPropietario = !!elemento?.propietarios.some((p) => p.usuarioId === usuario.id);

  useTitulo(elemento?.nombre);

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
  const emoji = emojiElemento(el, preferencias.emojis.elementos);
  const miPct = el.propietarios.find((p) => p.usuarioId === usuario.id)?.porcentaje ?? 100;

  const registrarInteres = () =>
    nav.go('RegistrarAjuste', {
      elementoId,
      valorActual: el.valorVigente,
      moneda: el.moneda,
      contexto: el.nombre,
      deuda: esDeuda,
      modoInteres: true,
      sentidoInicial: esDeuda ? 'Menor' : 'Mayor',
      motivoInicial: 'Interés del período',
      magnitudInicial: el.tasaInteres != null ? (pendiente * el.tasaInteres) / 100 / 12 : undefined,
    });
  const registrarValorizacion = () =>
    nav.go('Valorizar', { elementoId, valorActual: el.valorVigente, moneda: el.moneda, contexto: el.nombre });
  const registrarAjuste = () =>
    nav.go('RegistrarAjuste', {
      elementoId,
      valorActual: el.valorVigente,
      moneda: el.moneda,
      contexto: el.nombre,
      deuda: esDeuda,
    });
  // Secundaria fija: el interés en una deuda o crédito; si no, cuánto vale.
  const secundaria = conInteres
    ? { title: '💹 Sumar intereses', onPress: registrarInteres }
    : activo && el.admiteValorizacion
      ? { title: '📈 Actualizar cuánto vale', onPress: registrarValorizacion }
      : null;

  // ── Banda: qué es y cuánto ────────────────────────────────────────────────
  const color = esDeuda ? c.danger : esCredito ? c.ok : c.primary;
  const verbo = esDeuda
    ? 'Debes'
    : esCredito
      ? 'Te deben'
      : el.categoriaFuncional === 'ACTIVO' || el.categoriaFuncional === 'INVERSION'
        ? 'Vale'
        : 'Tiene';
  const montoBanda = el.valorOculto
    ? '—'
    : money(esDeuda ? Math.abs(el.valorVigente) : el.valorVigente, el.moneda);
  const subBanda = [
    sinTildes(etiqueta(el.tipo)) !== sinTildes(el.nombre) ? etiqueta(el.tipo) : null,
    el.naturaleza === 'CUSTODIA_INFORMAL' ? '📦 Encargo de otra persona' : null,
    el.estadoOperativo ? ESTADO_DEUDA[el.estadoOperativo] : null,
    el.fechaAlta ? `📅 Desde ${fechaLegible(el.fechaAlta)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // ── Movimientos ───────────────────────────────────────────────────────────
  // A9 — colapsar el par corrección + original en una sola fila con el monto
  // final; el evento de corrección no se lista aparte.
  const correccionDe = new Map<string, EventoFinancieroDTO>();
  for (const ev of eventos) {
    if (ev.correccionDeId) correccionDe.set(ev.correccionDeId, ev);
  }
  const movs = eventos.filter((ev) => !ev.correccionDeId);
  const movsVisibles = verTodos ? movs : movs.slice(0, MOVS_VISIBLES);
  const catPorId = new Map(categorias.map((x) => [x.id, x]));

  // En una deuda, los montos se muestran como cambian lo que debes (la banda
  // dice "Debes"): pagar la baja (verde) y un interés la sube (rojo).
  const efecto = (n: number) => (esDeuda ? -n : n);
  const conSigno = (n: number, moneda: string) => {
    const e = efecto(n);
    return `${e < 0 ? '−' : e > 0 ? '+' : ''}${money(Math.abs(e), moneda)}`;
  };
  const colorDe = (n: number, anulado: boolean) =>
    anulado
      ? {}
      : esDeuda
        ? { positivo: efecto(n) < 0, negativo: efecto(n) > 0 }
        : { positivo: n > 0 };

  // ── Cambios de valor: valorizaciones y correcciones de saldo, por fecha ────
  const cambiosValor: CambioValor[] = [
    ...valorizaciones.map((v) => ({ clase: 'valorizacion' as const, fecha: v.fecha, v })),
    ...ajustes.map((a) => ({ clase: 'ajuste' as const, fecha: a.fecha, a })),
  ].sort((x, y) => y.fecha.localeCompare(x.fecha));

  // ── Acciones ──────────────────────────────────────────────────────────────
  const acciones = esPropietario
    ? [
        ...(activo
          ? [
              {
                title: 'Editar',
                emoji: '✏️',
                subtitle: 'Nombre, tipo, de quién es',
                onPress: () => nav.go('EditarElemento', { elementoId, contexto: el.nombre }),
              },
              {
                title: 'Ajustes de la cuenta',
                emoji: '⚙️',
                subtitle: `Con el hogar: ${etiquetaNivel(el).toLowerCase()}`,
                onPress: () => nav.go('AjustesElemento', { elementoId }),
              },
              ...(el.admiteValorizacion && secundaria?.onPress !== registrarValorizacion
                ? [{ title: 'Actualizar cuánto vale', emoji: '📈', onPress: registrarValorizacion }]
                : []),
              {
                title: 'Corregir el saldo',
                emoji: '🔧',
                subtitle: 'Si no cuadra con tu banco',
                onPress: registrarAjuste,
              },
            ]
          : []),
        { title: '¿Cuánto valía antes?', emoji: '🗓️', onPress: () => nav.go('ValorEnFecha', { elementoId }) },
        {
          title: 'Historial de cambios',
          emoji: '🕓',
          onPress: () =>
            nav.go('Historial', { entidadTipo: 'ELEMENTO_PATRIMONIAL', entidadId: elementoId, contexto: el.nombre }),
        },
      ]
    : [];

  return (
    <Screen
      onRefresh={cargar}
      pie={
        esPropietario && el.estado === 'INACTIVO' ? (
          <Button
            title="♻️ Reactivar"
            onPress={() =>
              irAAccion(nav, {
                titulo: 'Reactivar',
                explicacion: 'Vuelve a contar en tu plata.',
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
              title={esDeuda ? '💳 Pagar' : esCredito ? '🤝 Me pagaron' : '💸 Anotar movimiento'}
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
      {el.estado === 'INACTIVO' && (
        <AvisoDetalle
          color={c.muted}
          texto={`📦 Desactivada${el.fechaBaja ? ` desde el ${fechaLegible(el.fechaBaja)}` : ''}: no suma en tu plata.`}
        />
      )}
      <BandaDetalle
        color={color}
        titulo={`${emoji} ${verbo}`}
        monto={montoBanda}
        sub={el.valorOculto ? 'No comparte cuánto tiene.' : subBanda || undefined}
      >
        {!el.valorOculto && miPct < 100 ? (
          <Datos plano>
            <Dato
              etiqueta={`🙋 Tu parte (${miPct}%)`}
              valor={money((el.valorVigente * miPct) / 100, el.moneda)}
            />
          </Datos>
        ) : null}
        {!el.valorOculto && reservado > 0 ? (
          // La misma resta del Inicio: lo que tiene, menos lo guardado para metas.
          <Datos plano>
            <Dato etiqueta="🐷 Guardado para metas" valor={`− ${money(reservado, el.moneda)}`} />
            <Dato etiqueta="✅ Puedes gastar" valor={money(libre, el.moneda)} />
          </Datos>
        ) : null}
      </BandaDetalle>

      {(esDeuda || esCredito) && (
        <Panel>
          {el.valorPendienteInicial != null && el.valorPendienteInicial > 0 && (
            <View style={styles.avance}>
              <Nota>
                {esDeuda ? 'Pagaste' : 'Te pagaron'} {money(el.valorPendienteInicial - pendiente, el.moneda)} de{' '}
                {money(el.valorPendienteInicial, el.moneda)}
              </Nota>
              <ProgressBar pct={((el.valorPendienteInicial - pendiente) / el.valorPendienteInicial) * 100} />
            </View>
          )}
          <Datos plano>
            {el.cuotaMonto != null ? <Dato etiqueta="💵 Cuota" valor={money(el.cuotaMonto, el.moneda)} /> : null}
            {el.fechaTermino ? <Dato etiqueta="🏁 Vence" valor={fechaLegible(el.fechaTermino)} /> : null}
            {el.contraparte ? (
              <Dato etiqueta={esDeuda ? '🏛️ Le debes a' : '👤 Te debe'} valor={el.contraparte} />
            ) : null}
            {el.fechaInicio ? <Dato etiqueta="📅 Empezó" valor={fechaLegible(el.fechaInicio)} /> : null}
            {el.tasaInteres != null ? (
              <Dato etiqueta="📈 Tasa" valor={`${String(el.tasaInteres).replace('.', ',')}% al año`} />
            ) : null}
            {el.observaciones ? <Dato etiqueta="📝 Notas" valor={el.observaciones} /> : null}
          </Datos>
        </Panel>
      )}

      {el.propietarios.length > 1 && (
        <Datos>
          <Dato
            etiqueta="👥 De quién es"
            valor={el.propietarios
              .map((p) => `${p.usuarioId === usuario.id ? 'Tú' : (p.nombre ?? 'Otra persona')} ${p.porcentaje}%`)
              .join(' · ')}
          />
        </Datos>
      )}

      {reservas.length > 0 && (
        <Section title="🎯 En metas">
          <ListCard>
            {reservas.map((r) => (
              <TxRow
                key={r.id}
                title={r.objetivoNombre ?? r.asignacionNombre}
                subtitle={r.objetivoNombre ? r.asignacionNombre : 'Ahorro sin meta'}
                amount={money(r.monto, el.moneda)}
                logo={{ emoji: r.objetivoId ? emojiMeta(r.objetivoId, preferencias.emojis.metas) : '🐷' }}
                onPress={() => nav.go('AsignacionDetalle', { asignacionId: r.asignacionId, contexto: el.nombre })}
              />
            ))}
          </ListCard>
        </Section>
      )}

      <Section title="🧾 Movimientos">
        {movs.length === 0 ? (
          <Nota>Aún no hay movimientos en esta cuenta.</Nota>
        ) : (
          <ListCard>
            {movsVisibles.map((ev) => {
              const impacto = ev.impactos.find((i) => i.elementoId === elementoId);
              const corr = correccionDe.get(ev.id);
              const corrImpacto = corr?.impactos.find((i) => i.elementoId === elementoId);
              const monto = (impacto?.monto ?? ev.monto) + (corr ? (corrImpacto?.monto ?? 0) : 0);
              const cat = ev.categoriaId ? catPorId.get(ev.categoriaId) : undefined;
              const titulo = ev.glosa || cat?.nombre || etiqueta(ev.tipo);
              const que = ev.tipo === 'SALDO_INICIAL' ? 'Con lo que empezó' : cat && cat.nombre !== titulo ? cat.nombre : etiqueta(ev.tipo);
              const estado = ev.anulado ? ' · eliminado' : corr ? ' · cambiado' : '';
              return (
                <TxRow
                  key={ev.id}
                  title={titulo}
                  subtitle={`${fechaLegible(ev.fecha)} · ${que}${estado}`}
                  amount={conSigno(monto, ev.moneda)}
                  {...colorDe(monto, ev.anulado)}
                  logo={{ emoji: emojiCategoria(cat) ?? emojiTipoMovimiento(ev.tipo) }}
                  onPress={() => nav.go('MovimientoDetalle', { eventoId: ev.id, elementoId, contexto: el.nombre })}
                />
              );
            })}
          </ListCard>
        )}
        {movs.length > MOVS_VISIBLES && (
          <Button
            title={verTodos ? 'Ver menos' : `⏬ Ver todos (${movs.length})`}
            variant="secondary"
            onPress={() => setVerTodos((v) => !v)}
          />
        )}
      </Section>

      {cambiosValor.length > 0 && (
        <Section title="📈 Cambios de valor">
          <ListCard>
            {cambiosValor.map((x) => {
              if (x.clase === 'valorizacion') {
                const v = x.v;
                const dif = v.valorNuevo - v.valorAnterior;
                const estado = v.anulada ? ' · eliminado' : v.correccionDeId ? ' · cambiado' : '';
                return (
                  <TxRow
                    key={v.id}
                    title={dif >= 0 ? 'Subió su valor' : 'Bajó su valor'}
                    subtitle={`${fechaLegible(v.fecha)}${estado}`}
                    amount={conSigno(dif, el.moneda)}
                    {...colorDe(dif, v.anulada)}
                    logo={{ emoji: dif >= 0 ? '📈' : '📉' }}
                    onPress={() =>
                      nav.go('ValorizacionDetalle', {
                        valorizacionId: v.id,
                        elementoId,
                        moneda: el.moneda,
                        contexto: el.nombre,
                      })
                    }
                  />
                );
              }
              const a = x.a;
              const estado = a.anulado ? ' · eliminado' : a.correccionDeId ? ' · cambiado' : '';
              return (
                <TxRow
                  key={a.id}
                  title={a.motivo}
                  subtitle={`${fechaLegible(a.fecha)}${estado}`}
                  amount={conSigno(a.monto, el.moneda)}
                  {...colorDe(a.monto, a.anulado)}
                  logo={{ emoji: /inter[eé]s/i.test(a.motivo) ? '💹' : '🔧' }}
                  onPress={() =>
                    nav.go('AjusteDetalle', { ajusteId: a.id, elementoId, moneda: el.moneda, contexto: el.nombre, deuda: esDeuda })
                  }
                />
              );
            })}
          </ListCard>
        </Section>
      )}

      {acciones.length > 0 && <MenuList items={acciones} />}

      <ErrorText>{error}</ErrorText>
      {esPropietario && (
        <View style={styles.destructivas}>
          {activo && (
            <Button
              title="📦 Desactivar"
              variant="danger"
              onPress={() =>
                irAAccion(nav, {
                  titulo: 'Desactivar',
                  explicacion: 'Deja de sumar en tu plata desde la fecha que digas. Puedes reactivarla después.',
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
          {eventos.length === 0 && valorizaciones.length === 0 && (
            <Button
              title="🗑️ Eliminar"
              variant="danger"
              onPress={() =>
                irAAccion(nav, {
                  titulo: 'Eliminar',
                  explicacion: 'Se borra para siempre. Se puede porque nunca tuvo movimientos.',
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
          {(esDeuda || esCredito) && pendiente > 0 && (
            <Button
              title={esDeuda ? '🤝 Me perdonaron la deuda' : '❌ No me van a pagar'}
              variant="danger"
              onPress={() =>
                irAAccion(nav, {
                  titulo: esDeuda ? 'Condonar deuda' : 'Declarar incobrable',
                  explicacion: esDeuda
                    ? 'Te perdonan lo que debes: queda en cero y tu plata sube. No se puede deshacer.'
                    : 'Ya no esperas que te paguen: queda en cero y tu plata baja. No se puede deshacer.',
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
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avance: { gap: 8, marginBottom: 4 },
  destructivas: { gap: 10, marginTop: 4 },
});
