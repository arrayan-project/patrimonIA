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
import { useAccionHeader, useNav } from '../navigation/navigator';
import { money } from '../format';
import { cadaCuando } from '../recurrencia';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { irAAccion } from './AccionFormScreen';
import {
  aISO,
  AccionDestructiva,
  Button,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  fechaLegible,
  Hero,
  LinkButton,
  Screen,
  Skeleton,
} from '../ui';

export function MovimientoProgramadoDetalleScreen() {
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
    m && nav.go('ProgramadoForm', { modo, movimientoId, monto: m.montoPlanificado, fecha: m.fechaProgramada, moneda: m.moneda });

  useAccionHeader('Editar', pendiente ? () => abrirForm('editar') : undefined);

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
      toast.mostrar(ingreso ? 'Listo, quedó anotado lo que llegó' : 'Pago confirmado');
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

  const categoria = categorias.find((c) => c.id === m.categoriaId);
  const saltarTexto = m.periodicidad === 'ANUAL' ? 'Este año no' : 'Este mes no';

  return (
    <Screen
      onRefresh={cargar}
      pie={
        vencido ? (
          <>
            <Button
              title={ingreso ? 'Sí, llegó' : 'Sí, se pagó'}
              onPress={confirmarTalCual}
              loading={busy === 'pagar'}
              disabled={busy !== null}
            />
            <Button title="Cambiar monto" variant="secondary" onPress={() => abrirForm('confirmar')} disabled={busy !== null} />
          </>
        ) : pendiente ? (
          <Button title="Confirmar pago" onPress={() => abrirForm('confirmar')} />
        ) : undefined
      }
    >
      <Hero
        label={
          vencido
            ? `${m.observaciones || categoria?.nombre || etiqueta(m.tipo)} · ${ingreso ? '¿Llegó?' : '¿Se pagó?'}`
            : `${etiqueta(m.tipo)} · ${etiqueta(m.estado).toLowerCase()}`
        }
        value={money(m.montoPlanificado, m.moneda)}
      />
      <Datos>
        <Dato etiqueta="Fecha programada" valor={fechaLegible(m.fechaProgramada)} />
        {m.periodicidad ? (
          <Dato etiqueta="Se repite" valor={cadaCuando(m.periodicidad, m.fechaProgramada, m.dia)} />
        ) : null}
        {categoria ? <Dato etiqueta="Categoría" valor={categoria.nombre} /> : null}
        {m.elementoOrigenId ? <Dato etiqueta="Desde" valor={enlaceEl(m.elementoOrigenId)} /> : null}
        {m.elementoDestinoId ? <Dato etiqueta="Hacia" valor={enlaceEl(m.elementoDestinoId)} /> : null}
        {m.observaciones ? <Dato etiqueta="Observaciones" valor={m.observaciones} /> : null}
        {m.eventoFinancieroId ? (
          <Dato
            etiqueta="Movimiento generado"
            valor={
              <LinkButton
                title="Ver ›"
                onPress={() => nav.go('MovimientoDetalle', { eventoId: m.eventoFinancieroId })}
              />
            }
          />
        ) : null}
      </Datos>
      <ErrorText>{error}</ErrorText>
      {pendiente && m.periodicidad && (
        <AccionDestructiva title={saltarTexto} onPress={() => void saltar(saltarTexto)} />
      )}
      {m.periodicidad ? (
        <AccionDestructiva
          title="Dejar de repetir"
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
      ) : pendiente && (
        <AccionDestructiva
          title="Cancelar movimiento"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Cancelar movimiento',
              explicacion: 'Se cancela y ya no podrás confirmar su pago. Queda en el historial.',
              pregunta: '¿Por qué lo cancelas?',
              boton: 'Cancelar movimiento',
              comando: 'CancelarMovimientoProgramado',
              body: { movimientoId },
              aviso: 'Movimiento cancelado',
              peligro: true,
            })
          }
        />
      )}
    </Screen>
  );
}
