import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type ObjetivoFinancieroDTO,
  type ReservaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { cuantoFalta, money, porcentaje } from '../format';
import { emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { irAAccion } from './AccionFormScreen';
import {
  AvisoDetalle,
  BandaDetalle,
  Button,
  Dato,
  Datos,
  ErrorText,
  fechaLegible,
  ListCard,
  MenuList,
  Nota,
  Pastilla,
  ProgressBar,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
} from '../ui';

export function ObjetivoDetalleScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const objetivoId = nav.route.params?.objetivoId as string;

  const [obj, setObj] = useState<ObjetivoFinancieroDTO | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const o = await api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${objetivoId}`, token);
      setObj(o);
      const asgs = await api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token);
      setAsignaciones(asgs);
      if (o.puedoModificar) {
        const els = await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
          .catch(() => []);
        setCuentas(els.filter((e) => e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO'));
        const rs = await Promise.all(
          asgs.map((a) => api.get<ReservaDTO[]>(`/asignaciones/${a.id}/reservas`, token).catch(() => [])),
        );
        setReservas(rs.flat());
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [objetivoId, token]);

  useCargaAlEnfocar(cargar);

  useTitulo(obj?.nombre);

  if (!obj) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // HZ-13: las cuentas propias donde la meta tiene plata; si es una sola, el
  // gasto llega con ella elegida.
  const cuentasConPlata = [
    ...new Set(
      reservas
        .filter((r) => r.estado === 'ACTIVA' && cuentas.some((c) => c.id === r.elementoOrigenId))
        .map((r) => r.elementoOrigenId),
    ),
  ];
  const nombresCuentas = cuentasConPlata.map((id) => cuentas.find((c) => c.id === id)?.nombre).filter(Boolean);
  const puedeAhorrar = obj.puedoModificar && obj.estado === 'EN_PROGRESO';
  const puedeUsar = obj.puedoModificar && cuentasConPlata.length > 0;
  const faltan = Math.max(obj.montoObjetivo - obj.progreso, 0);
  const lista = obj.estado === 'COMPLETADO' || faltan === 0;
  const agregarParte = () =>
    irAAccion(nav, {
      titulo: 'Agregar parte',
      explicacion: 'Divide la meta en partes (p. ej. "Pie" y "Gastos notariales") para seguir cada una por separado.',
      pregunta: '¿Cómo se llama la parte?',
      boton: 'Agregar parte',
      comando: 'CrearAsignacion',
      body: { objetivoId },
      campo: 'nombre',
      minimo: 1,
      aviso: 'Parte agregada',
    });

  return (
    <Screen
      onRefresh={cargar}
      pie={
        puedeAhorrar || puedeUsar ? (
          <>
            {/* D-1: ahorrar es una pantalla propia (varias cuentas, la cuenta de la meta). */}
            {puedeAhorrar && <Button title="🐷 Ahorrar" onPress={() => nav.go('Ahorrar', { objetivoId })} />}
            {puedeUsar && (
              <Button
                title="💸 Usar plata de la meta"
                variant={puedeAhorrar ? 'secondary' : undefined}
                onPress={() =>
                  nav.go('RegistrarMovimiento', {
                    tipo: 'GASTO',
                    objetivoId,
                    ...(cuentasConPlata.length === 1 ? { origenId: cuentasConPlata[0] } : {}),
                  })
                }
              />
            )}
          </>
        ) : undefined
      }
    >
      {obj.hogarId && !obj.puedoModificar && (
        <AvisoDetalle
          color={c.muted}
          texto="👀 Meta del hogar: puedes verla, pero no te agregaron para ahorrar en ella. Pídele a quien la creó que te agregue en ✏️ Editar."
        />
      )}
      {/* G35: la banda dice cuánto llevas y la resta hasta la meta. */}
      <BandaDetalle
        color={lista ? c.ok : c.primary}
        titulo={`${emojiMeta(objetivoId, preferencias.emojis.metas)} Llevas`}
        monto={money(obj.progreso, obj.moneda)}
        sub={lista ? '🎉 ¡Llegaste a la meta!' : `${porcentaje(obj.progresoPorcentaje)} de la meta`}
      >
        <View style={styles.barra}>
          <ProgressBar pct={obj.progresoPorcentaje} />
        </View>
        <Datos plano>
          <Dato etiqueta="🏁 Quieres juntar" valor={money(obj.montoObjetivo, obj.moneda)} />
          {!lista && <Dato etiqueta="⏳ Te faltan" valor={money(faltan, obj.moneda)} />}
        </Datos>
      </BandaDetalle>

      {(obj.hogarId || nombresCuentas.length > 0 || obj.fechaObjetivo || obj.estado === 'CANCELADO') && (
        <Datos>
          {obj.estado === 'CANCELADO' ? <Dato etiqueta="❌ Cancelada" valor="" /> : null}
          {obj.hogarId ? <Dato etiqueta="👥 Con el hogar" valor="Todos la ven" /> : null}
          {nombresCuentas.length > 0 ? <Dato etiqueta="🏦 Se guarda en" valor={nombresCuentas.join(', ')} /> : null}
          {obj.fechaObjetivo ? (
            <Dato
              etiqueta="📅 Para el"
              valor={`${fechaLegible(obj.fechaObjetivo)}${lista ? '' : ` · ${cuantoFalta(obj.fechaObjetivo).toLowerCase()}`}`}
            />
          ) : null}
        </Datos>
      )}

      {(asignaciones.length > 0 || obj.puedoModificar) && (
        <Section title="🧩 Partes">
          {asignaciones.length === 0 ? (
            <Nota>Aún no ahorras para esta meta.</Nota>
          ) : (
            <ListCard>
              {asignaciones.map((a) => (
                <TxRow
                  key={a.id}
                  title={a.nombre}
                  amount={money(a.totalReservado, a.moneda)}
                  logo={{ emoji: '🐷' }}
                  onPress={() => nav.go('AsignacionDetalle', { asignacionId: a.id, contexto: obj.nombre })}
                />
              ))}
            </ListCard>
          )}
          {obj.puedoModificar && (
            <View style={styles.fila}>
              <Pastilla label="➕ Agregar parte" onPress={agregarParte} />
            </View>
          )}
        </Section>
      )}

      <MenuList
        items={[
          ...(obj.puedoModificar || obj.esMio
            ? [
                {
                  title: 'Editar',
                  emoji: '✏️',
                  subtitle: 'Nombre, cuánto juntar, con quién',
                  onPress: () => nav.go('MetaForm', { objetivoId }),
                },
              ]
            : []),
          {
            title: 'Historial de cambios',
            emoji: '🕓',
            onPress: () =>
              nav.go('Historial', { entidadTipo: 'OBJETIVO_FINANCIERO', entidadId: objetivoId, contexto: obj.nombre }),
          },
        ]}
      />

      <ErrorText>{error}</ErrorText>
      {obj.esMio && (
        <Button
          title="🗑️ Eliminar meta"
          variant="danger"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar meta',
              explicacion: 'Lo ahorrado no se pierde: queda como ahorro sin meta (Planificar › Ahorro sin meta), y desde ahí lo puedes sacar.',
              pregunta: '¿Por qué la eliminas?',
              boton: 'Eliminar meta',
              comando: 'EliminarObjetivoFinanciero',
              body: { objetivoId },
              aviso: 'Meta eliminada',
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
  barra: { marginTop: 12 },
  fila: { flexDirection: 'row', marginTop: 10 },
});
