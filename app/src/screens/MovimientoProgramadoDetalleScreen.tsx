import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type MovimientoProgramadoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav } from '../navigation/navigator';
import { money } from '../format';
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
  LinkButton,
  Screen,
  Skeleton,
} from '../ui';

export function MovimientoProgramadoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const movimientoId = nav.route.params?.movimientoId as string;

  const [m, setM] = useState<MovimientoProgramadoDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [movimientoId, token]);

  useCargaAlEnfocar(cargar);

  const pendiente = m?.estado === 'PENDIENTE';
  const abrirForm = (modo: 'editar' | 'confirmar') =>
    m && nav.go('ProgramadoForm', { modo, movimientoId, monto: m.montoPlanificado, fecha: m.fechaProgramada, moneda: m.moneda });

  useAccionHeader('Editar', pendiente ? () => abrirForm('editar') : undefined);

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
    return el ? (
      <LinkButton title={`${el.nombre} ›`} onPress={() => nav.go('ElementoDetalle', { elementoId: id })} />
    ) : (
      'otra cuenta'
    );
  };

  return (
    <Screen
      onRefresh={cargar}
      pie={pendiente ? <Button title="Confirmar pago" onPress={() => abrirForm('confirmar')} /> : undefined}
    >
      <Hero
        label={`${etiqueta(m.tipo)} · ${etiqueta(m.estado).toLowerCase()}`}
        value={money(m.montoPlanificado, m.moneda)}
      />
      <Datos>
        <Dato etiqueta="Fecha programada" valor={fechaLegible(m.fechaProgramada)} />
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
      {pendiente && (
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
