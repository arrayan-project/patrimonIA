import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
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
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { EMOJI_ANOTAR, emojiCategoria } from '../emojis';
import { irAAccion } from './AccionFormScreen';
import type { DesdeMovimiento } from './PlantillaFormScreen';
import {
  aISO,
  AvisoDetalle,
  BandaDetalle,
  Button,
  Chip,
  colorAnotar,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  MenuList,
  Migaja,
  Nota,
  Screen,
  Skeleton,
  useC,
} from '../ui';

const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
/** "8 de octubre de 2026". */
const fechaLarga = (f: string) => {
  const [a, m, d] = f.slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES_LARGO[m - 1]} de ${a}`;
};
/** G35: qué pasó, en palabras de la puerta del "+". */
const VERBO: Record<string, string> = {
  GASTO: 'Gastaste',
  INGRESO: 'Recibiste',
  TRANSFERENCIA: 'Moviste',
  CONVERSION: 'Cambiaste',
  SALDO_INICIAL: 'Saldo inicial',
};

export function MovimientoDetalleScreen() {
  const c = useC();
  const { token, usuario } = useSession();
  const nav = useNav();
  const eventoId = nav.route.params?.eventoId as string;
  const elementoId = nav.route.params?.elementoId as string | undefined;
  const contexto = nav.route.params?.contexto as string | undefined;

  const [evento, setEvento] = useState<EventoFinancieroDTO | null>(null);
  // null = la cuenta no es visible para el usuario (no se enlaza).
  const [nombresImpacto, setNombresImpacto] = useState<Record<string, string | null>>({});
  const [presupuesto, setPresupuesto] = useState<PresupuestoDTO | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  // ¿Alguna de sus cuentas es tuya? Si no, es un movimiento de otro miembro del hogar.
  const [esMio, setEsMio] = useState(true);
  const [etiquetas, setEtiquetas] = useState<EtiquetaDTO[]>([]);
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
            return [im.elementoId, el.nombre, el.propietarios.some((p) => p.usuarioId === usuario.id)] as const;
          } catch {
            return [im.elementoId, null, false] as const;
          }
        }),
      );
      setNombresImpacto(Object.fromEntries(pares.map(([id, nombre]) => [id, nombre])));
      setEsMio(pares.length === 0 || pares.some(([, , mio]) => mio));
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
        setHogarId(hs[0]?.id ?? null);
        if (hs[0]) {
          setCategorias(
            await api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hs[0].id}/categorias-movimiento?incluirArchivadas=true`,
              token,
            ),
          );
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [eventoId, elementoId, token, usuario.id]);

  useCargaAlEnfocar(cargar);

  useTitulo(evento ? (evento.vigente ? evento.vigente.glosa : evento.glosa) || etiqueta(evento.tipo) : undefined);

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
  const categoria = categorias.find((x) => x.id === evento.categoriaId);
  const nombreCategoria = categoria?.nombre ?? 'Categoría';
  const origen = esInterno ? evento.impactos.find((i) => i.monto < 0) : undefined;
  const destino = esInterno ? evento.impactos.find((i) => i.monto > 0) : undefined;
  const esCorreccion = evento.correccionDeId !== null;
  // G39 (M12): si ya se cambió, se muestra cómo quedó (como en la lista).
  const vigente = evento.vigente;
  const tieneCorreccion = !!vigente;
  const glosa = vigente ? vigente.glosa : evento.glosa;
  const accionable = !evento.anulado && !esCorreccion && !tieneCorreccion;
  const puedePlantilla =
    !evento.anulado && (evento.tipo === 'GASTO' || evento.tipo === 'INGRESO' || evento.tipo === 'TRANSFERENCIA');
  const color = colorAnotar(c, evento.tipo);

  // G35: las cuentas, la categoría y el presupuesto son filas tocables; una
  // cuenta no visible o la cuenta desde la que se llegó queda como dato.
  const enlaces: { key: string; title: string; subtitle: string; emoji: string; onPress: () => void }[] = [];
  const datosCuenta: { etiqueta: string; valor: string }[] = [];
  // G39 (claridad): si la plata fue o vino de otra persona del hogar, se dice de quién es su cuenta.
  const otra = esInterno ? evento.contraparte : undefined;
  const cuenta = (id: string | undefined, rolBase: string) => {
    if (!id) return;
    const nombre = nombresImpacto[id];
    if (nombre === undefined) return;
    const deOtra = otra?.elementoId === id;
    const rol = deOtra ? `👤 Cuenta de ${otra!.nombre}` : rolBase;
    if (nombre === null || id === elementoId) {
      datosCuenta.push({ etiqueta: `🏦 ${rolBase}`, valor: nombre ?? (deOtra ? `Una cuenta de ${otra!.nombre}` : 'Otra cuenta') });
      return;
    }
    enlaces.push({
      key: `cuenta-${id}`,
      title: nombre,
      subtitle: rol,
      emoji: '🏦',
      onPress: () => nav.go('ElementoDetalle', { elementoId: id }),
    });
  };
  if (esInterno) {
    cuenta(origen?.elementoId, 'Salió de esta cuenta');
    cuenta(destino?.elementoId, 'Llegó a esta cuenta');
  } else if (evento.impactos[0]) {
    cuenta(evento.impactos[0].elementoId, evento.tipo === 'GASTO' ? 'Salió de esta cuenta' : 'Entró a esta cuenta');
  }
  const nombreDe = (id: string | undefined) => (id ? nombresImpacto[id] : undefined) ?? undefined;
  const cuentasBanda = esInterno
    ? [nombreDe(origen?.elementoId), nombreDe(destino?.elementoId)].filter(Boolean).join(' → ')
    : nombreDe(evento.impactos[0]?.elementoId);
  if (evento.categoriaId) {
    enlaces.push({
      key: 'categoria',
      title: nombreCategoria,
      subtitle: 'Categoría · ver sus movimientos del mes',
      emoji: emojiCategoria(categoria) ?? '🏷️',
      // G35 (Juan): se abre encima, con "atrás", como desde el presupuesto.
      onPress: () => {
        const [a, m] = evento.fecha.slice(0, 7).split('-').map(Number);
        const ultimo = new Date(a, m, 0).getDate();
        nav.go('GastosCategoria', {
          categoriaId: evento.categoriaId,
          nombre: nombreCategoria,
          emoji: emojiCategoria(categoria) ?? '🏷️',
          tipo: evento.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO',
          periodo: MESES_LARGO[m - 1],
          desde: `${evento.fecha.slice(0, 7)}-01`,
          hasta: `${evento.fecha.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`,
          moneda: evento.moneda,
          // De otro miembro: lo del hogar en esa categoría.
          hogarId: esMio ? undefined : (hogarId ?? undefined),
        });
      },
    });
  }
  if (presupuesto) {
    enlaces.push({
      key: 'presupuesto',
      title: `Presupuesto de ${MESES_LARGO[Number(evento.fecha.slice(5, 7)) - 1]}`,
      subtitle: 'Ver cómo va',
      emoji: '📊',
      onPress: () => nav.go('PresupuestoDetalle', { presupuestoId: presupuesto.id }),
    });
  }

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
  const editar = () =>
    nav.go('CorregirMovimiento', {
      eventoId,
      tipo: evento.tipo,
      monto: vigente?.monto ?? evento.monto,
      fecha: vigente?.fecha ?? evento.fecha,
      glosa,
      moneda: evento.moneda,
      // Un cambio de moneda no se corrige: se anota de nuevo (la tasa cambia los dos lados).
      corregible: evento.correccionDeId === null && !tieneCorreccion && evento.tipo !== 'CONVERSION',
      etiquetaIds: evento.etiquetaIds,
      // G39 (M12): "Anotar de nuevo" llena el formulario y, al anotar, elimina
      // este (primero sus cambios, del último al primero).
      reanotar:
        !esCorreccion && evento.tipo !== 'SALDO_INICIAL' && esMio
          ? {
              origenId: evento.impactos.find((i) => i.monto < 0)?.elementoId ?? null,
              destinoId: evento.impactos.find((i) => i.monto > 0)?.elementoId ?? null,
              montoDestino: evento.tipo === 'CONVERSION' ? (evento.impactos.find((i) => i.monto > 0)?.monto ?? null) : null,
              categoriaId: evento.categoriaId,
              anular: [...(vigente?.correccionIds ?? [])].reverse().concat(eventoId),
            }
          : null,
    });

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      {evento.anulado && (
        <AvisoDetalle color={c.danger} texto="🗑️ Este movimiento se eliminó: ya no cuenta en tus saldos." />
      )}
      <BandaDetalle
        color={color}
        titulo={
          otra
            ? otra.elementoId === origen?.elementoId
              ? `👤 ${otra.nombre} te pasó`
              : `👤 Le pasaste a ${otra.nombre}`
            : `${EMOJI_ANOTAR[evento.tipo] ?? '🧾'} ${VERBO[evento.tipo] ?? etiqueta(evento.tipo)}`
        }
        monto={money(vigente?.monto ?? evento.monto, evento.moneda)}
        sub={`📅 ${fechaLarga(vigente?.fecha ?? evento.fecha)}${cuentasBanda ? ` · ${cuentasBanda}` : ''}`}
      />

      {enlaces.length > 0 && <MenuList items={enlaces} />}
      {(glosa || impacto || datosCuenta.length > 0) && (
        <Datos>
          {datosCuenta.map((d) => (
            <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />
          ))}
          {glosa ? <Dato etiqueta="📝 Detalle" valor={glosa} /> : null}
          {impacto && <Dato etiqueta="💰 En esta cuenta" valor={money(impacto.monto, evento.moneda)} />}
        </Datos>
      )}
      {evento.etiquetaIds.length > 0 && (
        <View style={styles.chips}>
          {evento.etiquetaIds.map((id) => {
            const e = etiquetas.find((x) => x.id === id);
            return <Chip key={id} label={`🏷️ ${e?.nombre ?? '—'}`} color={e?.color} activo />;
          })}
        </View>
      )}
      {esCorreccion && <Nota>✏️ Es el cambio de un movimiento anterior.</Nota>}
      {vigente && (
        <Nota>
          {`✏️ Lo cambiaste: antes ${[
            vigente.monto !== evento.monto ? `era ${money(evento.monto, evento.moneda)}` : null,
            vigente.fecha !== evento.fecha ? `fue el ${fechaLarga(evento.fecha)}` : null,
            vigente.glosa !== evento.glosa ? `decía "${evento.glosa ?? 'sin detalle'}"` : null,
          ]
            .filter(Boolean)
            .join(', ')}.`}
        </Nota>
      )}

      <ErrorText>{error}</ErrorText>
      <View style={styles.acciones}>
        {!evento.anulado && <Button title="✏️ Editar" onPress={editar} />}
        {puedePlantilla && <Button title="⚡ Guardar como frecuente" variant="secondary" onPress={guardarComoPlantilla} />}
        {accionable && (
          <Button
            title="🗑️ Eliminar movimiento"
            variant="danger"
            onPress={() =>
              irAAccion(nav, {
                titulo: 'Eliminar movimiento',
                explicacion:
                  'Úsalo si el movimiento no ocurrió: se deshace su efecto en el saldo y queda en el historial como eliminado. Si ocurrió con otro monto o fecha, mejor cámbialo con Editar.',
                pregunta: '¿Por qué lo eliminas?',
                motivos: [
                  { emoji: '🙅', texto: 'No pasó' },
                  { emoji: '👯', texto: 'Estaba repetido' },
                ],
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  acciones: { gap: 10, marginTop: 4 },
});
