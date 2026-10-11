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
import { useToast } from '../ui/Toast';
import { Text } from '../ui/Text';
import {
  AvisoDetalle,
  BandaDetalle,
  Button,
  Dato,
  Datos,
  Elegir,
  ErrorText,
  Panel,
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
  const { preferencias, guardarPreferencias } = usePreferencias();
  const toast = useToast();
  const objetivoId = nav.route.params?.objetivoId as string;
  // Bloque M: la cuenta dedicada que se está quitando (se pregunta qué hacer con lo que tiene).
  const [quitando, setQuitando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [obj, setObj] = useState<ObjetivoFinancieroDTO | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      // En paralelo y se aplica de una vez (las cuentas y reservas solo sirven a quien puede modificar).
      const pAsgs = api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token);
      pAsgs.catch(() => undefined);
      const [o, asgs, els, rs] = await Promise.all([
        api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${objetivoId}`, token),
        pAsgs,
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token).catch(() => []),
        pAsgs.then((as) =>
          Promise.all(as.map((a) => api.get<ReservaDTO[]>(`/asignaciones/${a.id}/reservas`, token).catch(() => []))),
        ),
      ]);
      setObj(o);
      setAsignaciones(asgs);
      if (o.puedoModificar) {
        setCuentas(els.filter((e) => e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO'));
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
  // Bloque M: las cuentas dedicadas a la meta (las propias, para "Usar plata").
  const dedicadas = obj.cuentasDedicadas ?? [];
  const dedicadasPropias = dedicadas.filter((d) => cuentas.some((c) => c.id === d.elementoId));
  const puedeUsar = obj.puedoModificar && (cuentasConPlata.length > 0 || dedicadasPropias.length > 0);
  const elegibles = cuentas.filter(
    (e) =>
      ['LIQUIDEZ', 'RESERVA', 'INVERSION'].includes(e.categoriaFuncional) &&
      e.estado === 'ACTIVO' &&
      e.moneda === obj.moneda &&
      !dedicadas.some((d) => d.elementoId === e.id),
  );
  const sugerencias = (obj.sugerenciasCuentaCompleta ?? []).filter(
    (x) => !preferencias.noPreguntarCuentaCompleta.includes(x.elementoId),
  );
  const cambioMes = obj.cambioMesCuentas ?? 0;
  const comando = async (nombre: string, body: Record<string, unknown>, aviso: string) => {
    setOcupado(true);
    setError('');
    try {
      await api.post(`/comandos/${nombre}`, body, token);
      toast.mostrar(aviso);
      setQuitando(null);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    } finally {
      setOcupado(false);
    }
  };
  const dedicar = (elementoId: string) =>
    comando('DedicarCuentaAObjetivo', { objetivoId, elementoId }, 'Listo: toda la cuenta es para la meta');
  const quitar = (elementoId: string, conservarComoApartado: boolean) =>
    comando(
      'QuitarCuentaDeObjetivo',
      { objetivoId, elementoId, conservarComoApartado },
      conservarComoApartado ? 'La cuenta salió de la meta; lo que tenía quedó apartado' : 'La cuenta salió de la meta',
    );
  const noPreguntar = (elementoId: string) =>
    void guardarPreferencias({
      ...preferencias,
      noPreguntarCuentaCompleta: [...preferencias.noPreguntarCuentaCompleta, elementoId],
    }).catch(() => undefined);
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
                    // Bloque M (M-6): de una cuenta dedicada, el gasto baja la meta solo.
                    ...(cuentasConPlata.length === 0 && dedicadasPropias.length > 0
                      ? { objetivoId: undefined, origenId: dedicadasPropias[0].elementoId }
                      : {}),
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
          {/* Bloque M: el avance como una suma que cuadra (lo apartado + sus cuentas). */}
          {dedicadas.length > 0 && (obj.progresoApartado ?? 0) > 0 ? (
            <Dato etiqueta="🐷 Apartado" valor={money(obj.progresoApartado ?? 0, obj.moneda)} />
          ) : null}
          {dedicadas.length > 0 && (obj.progresoApartado ?? 0) > 0 ? (
            <Dato etiqueta="🏦 Sus cuentas" valor={money(obj.progresoCuentas ?? 0, obj.moneda)} />
          ) : null}
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

      {/* Bloque M §2.3: una vez, si una cuenta parece apartada entera para esta meta. */}
      {obj.puedoModificar &&
        sugerencias.map((x) => (
          <Panel key={x.elementoId}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: c.text }}>
              {`🏦 ¿Toda la cuenta ${x.nombre} es para ${obj.nombre}?`}
            </Text>
            <Nota>Así la meta sube y baja con lo que valga la cuenta.</Nota>
            <View style={styles.acciones}>
              <Pastilla label="Sí, toda" onPress={() => !ocupado && void dedicar(x.elementoId)} />
              <Pastilla label="No" onPress={() => noPreguntar(x.elementoId)} />
            </View>
          </Panel>
        ))}

      {/* Bloque M: "🏦 Esta cuenta es para esta meta" — la meta suma lo que valga cada una. */}
      {(dedicadas.length > 0 || (obj.puedoModificar && obj.estado !== 'CANCELADO')) && (
        <Section title="🏦 Cuentas de esta meta">
          {dedicadas.length > 0 && (
            <ListCard>
              {dedicadas.map((d) => (
                <View key={d.elementoId}>
                  <TxRow
                    title={d.nombre}
                    subtitle="Toda la cuenta"
                    amount={money(d.valor, d.moneda)}
                    logo={{ emoji: '🏦' }}
                    onPress={
                      obj.puedoModificar ? () => setQuitando((q) => (q === d.elementoId ? null : d.elementoId)) : undefined
                    }
                  />
                  {quitando === d.elementoId && (
                    <View style={styles.quitar}>
                      {/* Juan (2026-10-11): se pregunta, sin opción preelegida. */}
                      <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                        {`¿Quitar ${d.nombre} de la meta? ¿Dejar lo que tiene (${money(d.valor, d.moneda)}) apartado para ella?`}
                      </Text>
                      <View style={styles.acciones}>
                        <Pastilla label="🐷 Sí, dejarlo apartado" onPress={() => !ocupado && void quitar(d.elementoId, true)} />
                        <Pastilla label="No, que quede libre" onPress={() => !ocupado && void quitar(d.elementoId, false)} />
                        <Pastilla label="Cancelar" onPress={() => setQuitando(null)} />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ListCard>
          )}
          {cambioMes !== 0 && (
            <Nota>{`${cambioMes < 0 ? '📉 −' : '📈 +'}${money(Math.abs(cambioMes), obj.moneda)} este mes`}</Nota>
          )}
          {obj.puedoModificar && obj.estado !== 'CANCELADO' && elegibles.length > 0 && (
            <Elegir
              label="¿Qué cuenta es para esta meta?"
              value={null}
              options={elegibles.map((e) => ({ value: e.id, label: e.nombre, sub: money(e.valorVigente, e.moneda) }))}
              onChange={(v) => v && void dedicar(v)}
              boton={(abrir) => (
                <View style={styles.fila}>
                  <Pastilla label="➕ Esta cuenta es para esta meta" onPress={abrir} />
                </View>
              )}
            />
          )}
        </Section>
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
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quitar: { gap: 10, paddingBottom: 12 },
});
