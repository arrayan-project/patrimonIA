import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type EtiquetaDTO,
  type EventoFinancieroDTO,
  type HogarDTO,
  type PresupuestoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import type { DesdeMovimiento } from './PlantillaFormScreen';
import {
  aISO,
  AccionDestructiva,
  Button,
  Chip,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  fechaLegible,
  Hero,
  LinkButton,
  Migaja,
  Nota,
  Screen,
  Skeleton,
} from '../ui';

export function MovimientoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const eventoId = nav.route.params?.eventoId as string;
  const elementoId = nav.route.params?.elementoId as string | undefined;
  const contexto = nav.route.params?.contexto as string | undefined;

  const [evento, setEvento] = useState<EventoFinancieroDTO | null>(null);
  // null = la cuenta no es visible para el usuario (no se enlaza).
  const [nombresImpacto, setNombresImpacto] = useState<Record<string, string | null>>({});
  const [presupuesto, setPresupuesto] = useState<PresupuestoDTO | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaDTO[]>([]);
  const [tieneCorreccion, setTieneCorreccion] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const ev = await api.get<EventoFinancieroDTO>(`/eventos-financieros/${eventoId}`, token);
      setEvento(ev);
      const pares = await Promise.all(
        ev.impactos.map(async (im) => {
          try {
            const el = await api.get<ElementoPatrimonialDTO>(
              `/elementos-patrimoniales/${im.elementoId}`,
              token,
            );
            return [im.elementoId, el.nombre] as const;
          } catch {
            return [im.elementoId, null] as const;
          }
        }),
      );
      setNombresImpacto(Object.fromEntries(pares));
      // G32 H-05 — un gasto del mes en curso enlaza al presupuesto vigente.
      if (ev.tipo === 'GASTO' && ev.fecha.slice(0, 7) === aISO(new Date()).slice(0, 7)) {
        const presus = await api.get<PresupuestoDTO[]>('/presupuestos', token).catch(() => []);
        setPresupuesto(presus.find((x) => x.vigente && x.estado !== 'CERRADO') ?? null);
      }
      if (etiquetas.length === 0) {
        setEtiquetas(await api.get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token).catch(() => []));
      }
      if (ev.categoriaId && categorias.length === 0) {
        const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        if (hs[0]) {
          setCategorias(
            await api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hs[0].id}/categorias-movimiento?incluirArchivadas=true`,
              token,
            ),
          );
        }
      }
      if (elementoId) {
        const lista = await api.get<EventoFinancieroDTO[]>(
          `/eventos-financieros?elemento=${elementoId}`,
          token,
        );
        setTieneCorreccion(lista.some((e) => e.correccionDeId === eventoId && !e.anulado));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [eventoId, elementoId, token]);

  useCargaAlEnfocar(cargar);

  useTitulo(evento ? evento.glosa || etiqueta(evento.tipo) : undefined);
  useAccionHeader(
    'Editar',
    evento && !evento.anulado
      ? () =>
          nav.go('CorregirMovimiento', {
            eventoId,
            monto: evento.monto,
            fecha: evento.fecha,
            glosa: evento.glosa,
            moneda: evento.moneda,
            corregible: evento.correccionDeId === null && !tieneCorreccion,
            etiquetaIds: evento.etiquetaIds,
          })
      : undefined,
  );

  if (!evento) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const impacto = evento.impactos.find((i) => i.elementoId === elementoId);
  const esInterno = evento.tipo === 'TRANSFERENCIA' || evento.tipo === 'CONVERSION';
  const nombreCategoria = categorias.find((c) => c.id === evento.categoriaId)?.nombre ?? 'Categoría';
  /** Nombre de la cuenta, tocable si es visible y no es la cuenta desde la que se llegó. */
  const enlaceCuenta = (id: string | undefined) => {
    if (!id) return '—';
    const nombre = nombresImpacto[id];
    if (nombre === undefined) return '…';
    if (nombre === null) return 'otra cuenta';
    if (id === elementoId) return nombre;
    return (
      <LinkButton
        title={`${nombre} ›`}
        onPress={() => nav.go('ElementoDetalle', { elementoId: id })}
      />
    );
  };
  const origen = esInterno ? evento.impactos.find((i) => i.monto < 0) : undefined;
  const destino = esInterno ? evento.impactos.find((i) => i.monto > 0) : undefined;
  const esCorreccion = evento.correccionDeId !== null;
  const accionable = !evento.anulado && !esCorreccion && !tieneCorreccion;
  const puedePlantilla =
    !evento.anulado && (evento.tipo === 'GASTO' || evento.tipo === 'INGRESO' || evento.tipo === 'TRANSFERENCIA');


  const guardarComoPlantilla = () => {
    const desde: DesdeMovimiento = {
      nombre: evento.glosa ?? '',
      tipo: evento.tipo as DesdeMovimiento['tipo'],
      monto: evento.monto,
      moneda: evento.moneda,
      origenId: evento.impactos.find((i) => Number(i.monto) < 0)?.elementoId ?? null,
      destinoId: evento.impactos.find((i) => Number(i.monto) > 0)?.elementoId ?? null,
      categoriaId: evento.categoriaId,
      glosa: evento.glosa ?? '',
    };
    nav.go('PlantillaForm', { desde });
  };

  return (
    <Screen
      onRefresh={cargar}
      pie={puedePlantilla ? <Button title="Guardar como plantilla" variant="secondary" onPress={guardarComoPlantilla} /> : undefined}
    >
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Hero
        label={evento.anulado ? `${etiqueta(evento.tipo)} · eliminado` : etiqueta(evento.tipo)}
        value={money(evento.monto, evento.moneda)}
      />

      <Datos>
        <Dato etiqueta="Fecha" valor={fechaLegible(evento.fecha)} />
        {esInterno ? (
          <>
            <Dato etiqueta="Desde" valor={enlaceCuenta(origen?.elementoId)} />
            <Dato etiqueta="Hacia" valor={enlaceCuenta(destino?.elementoId)} />
          </>
        ) : evento.impactos[0] ? (
          <Dato etiqueta="Cuenta" valor={enlaceCuenta(evento.impactos[0].elementoId)} />
        ) : null}
        {evento.glosa ? <Dato etiqueta="Detalle" valor={evento.glosa} /> : null}
        {evento.categoriaId ? (
          <Dato
            etiqueta="Categoría"
            valor={
              <LinkButton
                title={`${nombreCategoria} ›`}
                onPress={() =>
                  nav.irATab('Movimientos', {
                    categoriaId: evento.categoriaId,
                    categoriaNombre: nombreCategoria,
                    mes: evento.fecha,
                  })
                }
              />
            }
          />
        ) : null}
        {presupuesto ? (
          <Dato
            etiqueta="Presupuesto"
            valor={
              <LinkButton
                title="Ver el del mes ›"
                onPress={() => nav.go('PresupuestoDetalle', { presupuestoId: presupuesto.id })}
              />
            }
          />
        ) : null}
        {impacto && <Dato etiqueta="Efecto en esta cuenta" valor={money(impacto.monto, evento.moneda)} />}
        <Dato etiqueta="Estado" valor={evento.anulado ? 'Eliminado' : 'Vigente'} />
      </Datos>
      {evento.etiquetaIds.length > 0 && (
        <View style={styles.chips}>
          {evento.etiquetaIds.map((id) => {
            const e = etiquetas.find((x) => x.id === id);
            return <Chip key={id} label={e?.nombre ?? '—'} color={e?.color} activo />;
          })}
        </View>
      )}
      {esCorreccion && <Nota>Es la corrección de un movimiento anterior.</Nota>}
      {tieneCorreccion && <Nota>Este movimiento ya fue corregido: corrige o elimina esa corrección.</Nota>}

      <ErrorText>{error}</ErrorText>
      {accionable && (
        <AccionDestructiva
          title="Eliminar movimiento"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar movimiento',
              explicacion:
                'Úsalo si el movimiento no ocurrió: se revierte su efecto sobre el saldo y queda en el historial como eliminado. Si ocurrió con otro monto o fecha, mejor corrígelo con Editar.',
              pregunta: '¿Por qué lo eliminas?',
              boton: 'Eliminar movimiento',
              comando: 'AnularEventoFinanciero',
              body: { eventoId },
              aviso: 'Movimiento eliminado',
              peligro: true,
              volver: 2,
            })
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
