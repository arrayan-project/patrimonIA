import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MovimientoProgramadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { cuantoFalta, money } from '../format';
import { EMOJI_ANOTAR, emojiCategoria } from '../emojis';
import { cadaCuando } from '../recurrencia';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { irAAccion } from './AccionFormScreen';
import { fechaCorta, tituloProgramado } from './MovimientosProgramadosScreen';
import {
  aISO,
  BandaDetalle,
  Button,
  colorAnotar,
  Dato,
  Datos,
  ErrorText,
  fechaLegible,
  LinkButton,
  MenuList,
  Screen,
  Skeleton,
  useC,
} from '../ui';

/** G35: qué pasa con la plata, según el tipo, antes y después de confirmarlo. */
const VA_A = { GASTO: 'Vas a pagar', INGRESO: 'Te va a llegar', TRANSFERENCIA: 'Vas a mover' } as const;
const TOCABA = { GASTO: 'Tocaba pagar', INGRESO: 'Tenía que llegarte', TRANSFERENCIA: 'Tocaba mover' } as const;
const YA = { GASTO: 'Pagaste', INGRESO: 'Te llegó', TRANSFERENCIA: 'Moviste' } as const;

export function MovimientoProgramadoDetalleScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const movimientoId = nav.route.params?.movimientoId as string;

  const [m, setM] = useState<MovimientoProgramadoDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [elementosHogar, setElementosHogar] = useState<ElementoPatrimonialDTO[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [busy, setBusy] = useState<'pagar' | 'saltar' | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setM(await api.get<MovimientoProgramadoDTO>(`/movimientos-programados/${movimientoId}`, token));
      setElementos(
        await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
          .catch(() => []),
      );
      // D-5: el destino de una transferencia puede ser de otro miembro.
      setElementosHogar(
        await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token)
          .catch(() => []),
      );
      // D-6: el nombre de la categoría del programado.
      setCategorias(
        await api
          .get<HogarDTO[]>('/usuarios/me/hogares', token)
          .then((hs) =>
            hs[0] ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hs[0].id}/categorias-movimiento`, token) : [],
          )
          .catch(() => []),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [movimientoId, token]);

  useCargaAlEnfocar(cargar);

  const pendiente = m?.estado === 'PENDIENTE';
  const abrirForm = (modo: 'editar' | 'confirmar') =>
    m &&
    nav.go('ProgramadoForm', {
      modo,
      movimientoId,
      monto: m.montoPlanificado,
      fecha: m.fechaProgramada,
      moneda: m.moneda,
      tipo: m.tipo,
      // G35: el pie de "Confirmar" dice en qué cuenta se anota.
      cuenta: [...elementos, ...elementosHogar].find((e) => e.id === (m.elementoOrigenId ?? m.elementoDestinoId))?.nombre,
    });

  useTitulo(m ? tituloProgramado(m, categorias, [...elementos, ...elementosHogar]) : 'Movimiento programado');

  // D-6: llegada la fecha, el aviso pregunta "¿Se pagó?" (o "¿Llegó?" en un ingreso).
  const vencido = pendiente && !!m && m.fechaProgramada.slice(0, 10) <= aISO(new Date());
  const ingreso = m?.tipo === 'INGRESO';

  /** "Sí, se pagó": confirma con el monto planificado y la fecha que tocaba. */
  const confirmarTalCual = async () => {
    if (!m) return;
    setBusy('pagar');
    setError('');
    try {
      await api.post(
        '/comandos/MaterializarMovimientoProgramado',
        { movimientoId, fechaEfectiva: m.fechaProgramada.slice(0, 10) },
        token,
      );
      toast.mostrar(ingreso ? 'Listo, quedó anotado lo que llegó' : 'Listo, quedó anotado');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(null);
    }
  };

  /** "Este mes no": cancela solo esta vez; la serie sigue. */
  const saltar = async (texto: string) => {
    const ok = await confirmar(`${texto}`, 'No se anota nada esta vez. Te volvemos a avisar en la próxima fecha.', texto);
    if (!ok) return;
    setBusy('saltar');
    setError('');
    try {
      await api.post('/comandos/CancelarMovimientoProgramado', { movimientoId, motivo: texto }, token);
      toast.mostrar('Listo, esta vez no');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(null);
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

  /** G32 H-05 — la cuenta es tocable si es visible para el usuario. */
  const enlaceEl = (id: string) => {
    const el = elementos.find((e) => e.id === id);
    if (el) {
      return <LinkButton title={`${el.nombre} ›`} onPress={() => nav.go('ElementoDetalle', { elementoId: id })} />;
    }
    const ajena = elementosHogar.find((e) => e.id === id);
    return ajena ? `${ajena.nombre} (de ${ajena.propietarios[0]?.nombre ?? 'otro miembro'})` : 'otra cuenta';
  };

  const categoria = categorias.find((x) => x.id === m.categoriaId);
  const saltarTexto = m.periodicidad === 'ANUAL' ? 'Este año no' : 'Este mes no';
  const transferencia = m.tipo === 'TRANSFERENCIA';
  const fecha = m.fechaProgramada.slice(0, 10);
  const titulo =
    vencido ? TOCABA[m.tipo] : m.estado === 'PENDIENTE' ? VA_A[m.tipo] : m.estado === 'MATERIALIZADO' ? YA[m.tipo] : 'No se hizo';
  const sub = vencido
    ? `⏰ Era el ${fechaCorta(fecha)} · ${ingreso ? '¿llegó?' : transferencia ? '¿se hizo?' : '¿se pagó?'}`
    : pendiente
      ? `📅 ${fechaLegible(fecha)} · ${cuantoFalta(fecha).toLowerCase()}`
      : m.estado === 'MATERIALIZADO'
        ? `✅ ${fechaLegible(fecha)}`
        : `❌ Cancelado · era el ${fechaLegible(fecha)}`;
  // Lo que se ofrece al tocar el botón principal, según el tipo.
  const yaPaso = ingreso ? 'Sí, llegó' : transferencia ? 'Sí, se hizo' : 'Sí, se pagó';
  const adelantar = ingreso ? 'Ya llegó' : transferencia ? 'Ya lo hice' : 'Ya lo pagué';

  return (
    <Screen
      onRefresh={cargar}
      pie={
        vencido ? (
          <>
            <Button
              title={`✅ ${yaPaso}`}
              onPress={confirmarTalCual}
              loading={busy === 'pagar'}
              disabled={busy !== null}
            />
            <Button title="✏️ Fue otro monto" variant="secondary" onPress={() => abrirForm('confirmar')} disabled={busy !== null} />
          </>
        ) : pendiente ? (
          <Button title={`✅ ${adelantar}`} onPress={() => abrirForm('confirmar')} />
        ) : undefined
      }
    >
      <BandaDetalle
        color={m.estado === 'CANCELADO' ? c.muted : colorAnotar(c, m.tipo)}
        titulo={`${EMOJI_ANOTAR[m.tipo]} ${titulo}`}
        monto={money(m.montoPlanificado, m.moneda)}
        sub={sub}
      />
      <Datos>
        {m.periodicidad ? (
          <Dato etiqueta="🔁 Se repite" valor={cadaCuando(m.periodicidad, m.fechaProgramada, m.dia)} />
        ) : null}
        {m.elementoOrigenId ? (
          <Dato etiqueta={transferencia ? '🏦 Desde' : '🏦 Sale de'} valor={enlaceEl(m.elementoOrigenId)} />
        ) : null}
        {m.elementoDestinoId ? (
          <Dato etiqueta={transferencia ? '🏦 Hacia' : '🏦 Llega a'} valor={enlaceEl(m.elementoDestinoId)} />
        ) : null}
        {categoria ? <Dato etiqueta={`${emojiCategoria(categoria)} Categoría`} valor={categoria.nombre} /> : null}
      </Datos>

      {(pendiente || m.eventoFinancieroId) && (
        <MenuList
          items={[
            ...(m.eventoFinancieroId
              ? [
                  {
                    title: 'Ver lo que quedó anotado',
                    emoji: '🧾',
                    onPress: () => nav.go('MovimientoDetalle', { eventoId: m.eventoFinancieroId }),
                  },
                ]
              : []),
            ...(pendiente
              ? [{ title: 'Cambiar monto o fecha', emoji: '✏️', onPress: () => abrirForm('editar') }]
              : []),
            ...(pendiente && m.periodicidad
              ? [
                  {
                    title: saltarTexto,
                    emoji: '⏭️',
                    subtitle: 'No se anota nada esta vez',
                    onPress: () => void saltar(saltarTexto),
                  },
                ]
              : []),
          ]}
        />
      )}

      <ErrorText>{error}</ErrorText>
      {m.periodicidad ? (
        <Button
          title="🛑 Dejar de repetir"
          variant="danger"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Dejar de repetir',
              explicacion: 'No te avisamos más. Las fechas que ya pasaron y no confirmaste siguen pendientes.',
              pregunta: '¿Por qué dejas de repetirlo?',
              boton: 'Dejar de repetir',
              comando: 'CancelarMovimientoProgramado',
              body: { movimientoId, serie: true },
              aviso: 'Ya no se repite',
              peligro: true,
            })
          }
        />
      ) : (
        pendiente && (
          <Button
            title="🗑️ Cancelar este movimiento"
            variant="danger"
            onPress={() =>
              irAAccion(nav, {
                titulo: 'Cancelar movimiento',
                explicacion: 'Se cancela y ya no podrás confirmarlo. Queda en el historial.',
                pregunta: '¿Por qué lo cancelas?',
                boton: 'Cancelar movimiento',
                comando: 'CancelarMovimientoProgramado',
                body: { movimientoId },
                aviso: 'Movimiento cancelado',
                peligro: true,
              })
            }
          />
        )
      )}
    </Screen>
  );
}
