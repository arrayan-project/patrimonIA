import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type DesviacionPresupuestariaDTO,
  type HogarDTO,
  type PresupuestoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money, porcentaje } from '../format';
import { emojiCategoria, emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { irAAccion } from './AccionFormScreen';
import { nombrePeriodo } from './PresupuestosScreen';
import {
  AvisoDetalle,
  BandaDetalle,
  Button,
  colorCategoria,
  Dato,
  Datos,
  ErrorText,
  GoalCard,
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
import { Text } from '../ui/Text';
import { Dona } from '../ui/charts';

/**
 * G35: un presupuesto como una resta que cuadra (pensabas gastar − gastaste =
 * te quedan), en qué gastaste por categoría y lo ahorrado para metas.
 */
export function PresupuestoDetalleScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const presupuestoId = nav.route.params?.presupuestoId as string;

  const [p, setP] = useState<PresupuestoDTO | null>(null);
  const [desv, setDesv] = useState<DesviacionPresupuestariaDTO | null>(null);
  const [cats, setCats] = useState<CategoriaMovimientoDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [presu, desviacion] = await Promise.all([
        api.get<PresupuestoDTO>(`/presupuestos/${presupuestoId}`, token),
        api.get<DesviacionPresupuestariaDTO>(`/presupuestos/${presupuestoId}/desviacion`, token),
      ]);
      setP(presu);
      setDesv(desviacion);
      // Solo para el emoji de cada categoría.
      const hogarId =
        presu.hogarId ??
        (await api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []))[0]?.id ??
        null;
      if (hogarId)
        setCats(
          await api.get<CategoriaMovimientoDTO[]>(`/hogares/${hogarId}/categorias-movimiento`, token).catch(() => []),
        );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [presupuestoId, token]);

  useCargaAlEnfocar(cargar);

  useTitulo(p ? nombrePeriodo(p.fechaInicio, p.fechaFin) : undefined);

  if (!p || !desv) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const m = (n: number) => money(n, p.moneda);
  const abierto = p.estado !== 'CERRADO';
  const puedeCerrar = p.periodicidad === 'ESPECIFICO' && p.estado === 'ACTIVO';
  const catPorId = new Map(cats.map((x) => [x.id, x]));
  const emojiDe = (id: string, nombre: string) => emojiCategoria(catPorId.get(id) ?? { nombre, icono: null }) ?? '🏷️';

  const gastado = desv.real.gastos;
  const pensado = desv.esperado.gastos;
  const pasado = pensado > 0 && gastado > pensado;
  const pctGasto = pensado > 0 ? (gastado / pensado) * 100 : 0;

  const rubrosGasto = desv.porRubro.filter((r) => r.tipoAplicable !== 'INGRESO' && (r.esperado > 0 || r.real > 0));
  const sinMonto = rubrosGasto.filter((r) => r.esperado === 0);
  const rubrosIngreso = desv.porRubro.filter((r) => r.tipoAplicable === 'INGRESO' && r.esperado > 0);
  const segmentos = [
    ...rubrosGasto.map((r, i) => ({ label: r.nombre, valor: r.real, color: colorCategoria(r.color, i) })),
    { label: 'Sin categoría', valor: desv.sinClasificar.gastos, color: c.muted },
  ].filter((s) => s.valor > 0);
  const verEntra = desv.esperado.ingresos > 0 || desv.esperado.ahorro > 0 || rubrosIngreso.length > 0;
  const sobra = desv.real.ahorro;

  const irAMontos = () =>
    nav.go('PresupuestoForm', {
      presupuestoId,
      ingresos: p.ingresosEsperados,
      gastos: p.gastosEsperados,
      ahorro: p.ahorroEsperado,
      moneda: p.moneda,
    });
  // G35 (Juan): los gastos de una categoría se abren encima (con "atrás"),
  // no saltando a la pestaña Movimientos.
  const verGastos = (categoriaId: string | null, nombre: string, emoji: string, esperado: number) =>
    nav.go('GastosCategoria', {
      categoriaId,
      nombre,
      emoji,
      esperado,
      periodo: nombrePeriodo(p.fechaInicio, p.fechaFin),
      desde: (desv.periodo.desde ?? p.fechaInicio ?? '').slice(0, 10),
      hasta: (desv.periodo.hasta ?? p.fechaFin ?? '').slice(0, 10),
      moneda: p.moneda,
      hogarId: p.hogarId ?? undefined,
    });
  const irARubros = () => nav.go('PresupuestoRubros', { presupuestoId });

  return (
    <Screen
      onRefresh={cargar}
      pie={abierto ? <Button title="🧩 Repartir por categoría" onPress={irARubros} /> : undefined}
    >
      {!abierto && <AvisoDetalle color={c.muted} texto="🏁 Presupuesto cerrado: ya no cambia." />}

      <BandaDetalle
        color={pasado ? c.danger : c.ok}
        titulo="🧾 Llevas gastado"
        monto={m(gastado)}
        sub={`${pensado > 0 ? `${porcentaje(pctGasto)} de lo que pensabas · ` : ''}${p.tipo === 'FAMILIAR' ? '👥 Del hogar' : '🙋 Solo tuyo'}`}
      >
        {pensado > 0 ? (
          <>
            <View style={styles.barra}>
              <ProgressBar pct={pctGasto} />
            </View>
            <Datos plano>
              <Dato etiqueta="🎯 Pensabas gastar" valor={m(pensado)} />
              <Dato
                etiqueta={pasado ? '⚠️ Te pasaste' : '✅ Te quedan'}
                valor={<Text style={[styles.cifra, { color: pasado ? c.danger : c.ok }]}>{m(Math.abs(pensado - gastado))}</Text>}
              />
            </Datos>
          </>
        ) : null}
      </BandaDetalle>

      {verEntra && (
        <Section title="📥 Lo que entra y lo que sobra">
          <Datos>
            <Dato
              etiqueta="📥 Te entró"
              valor={desv.esperado.ingresos > 0 ? `${m(desv.real.ingresos)} de ${m(desv.esperado.ingresos)}` : m(desv.real.ingresos)}
            />
            {rubrosIngreso.map((r) => (
              <Dato
                key={r.categoriaId}
                etiqueta={`   ${emojiDe(r.categoriaId, r.nombre)} ${r.nombre}`}
                valor={`${m(r.real)} de ${m(r.esperado)}`}
              />
            ))}
            <Dato etiqueta="🧾 Gastaste" valor={`− ${m(gastado)}`} />
            <Dato
              etiqueta={sobra >= 0 ? '🎉 Te sobra' : '⚠️ Gastaste más de lo que entró'}
              valor={<Text style={[styles.cifra, { color: sobra >= 0 ? c.ok : c.danger }]}>{m(Math.abs(sobra))}</Text>}
            />
            {desv.esperado.ahorro > 0 ? <Dato etiqueta="🐷 Querías que sobrara" valor={m(desv.esperado.ahorro)} /> : null}
          </Datos>
        </Section>
      )}

      <Section title="🧾 En qué gastaste">
        {rubrosGasto.length === 0 && desv.sinClasificar.gastos === 0 ? (
          <Nota>Todavía no gastas nada en este período.</Nota>
        ) : (
          <>
            {/* Juan: la dona solo si reparte algo (2 o más categorías con gasto). */}
            {segmentos.length >= 2 && (
              <Panel>
                <Dona segmentos={segmentos} centro={m(gastado).replace(` ${p.moneda}`, '')} formatoValor={m} />
              </Panel>
            )}
            {rubrosGasto.filter((r) => r.esperado > 0).map((r) => {
              const pct = (r.real / r.esperado) * 100;
              const pasa = r.real > r.esperado;
              return (
                <GoalCard
                  key={r.categoriaId}
                  emoji={emojiDe(r.categoriaId, r.nombre)}
                  name={r.nombre}
                  tag={pasa ? `⚠️ Te pasaste ${m(r.real - r.esperado)}` : `✅ Quedan ${m(r.esperado - r.real)}`}
                  hint={porcentaje(pct)}
                  pct={pct}
                  ok={!pasa}
                  mal={pasa}
                  footLeft={`Llevas ${m(r.real)} de ${m(r.esperado)}`}
                  onPress={() => verGastos(r.categoriaId, r.nombre, emojiDe(r.categoriaId, r.nombre), r.esperado)}
                />
              );
            })}
            {/* Lo que no tiene monto pensado: filas simples (una barra vacía no dice nada). */}
            {(sinMonto.length > 0 || desv.sinClasificar.gastos > 0) && (
              <ListCard>
                {sinMonto.map((r) => (
                  <TxRow
                    key={r.categoriaId}
                    title={r.nombre}
                    subtitle="Sin monto pensado"
                    amount={m(r.real)}
                    logo={{ emoji: emojiDe(r.categoriaId, r.nombre) }}
                    onPress={() => verGastos(r.categoriaId, r.nombre, emojiDe(r.categoriaId, r.nombre), 0)}
                  />
                ))}
                {desv.sinClasificar.gastos > 0 && (
                  <TxRow
                    title="Sin categoría"
                    subtitle="Gastos que anotaste sin categoría"
                    amount={m(desv.sinClasificar.gastos)}
                    logo={{ emoji: '❓' }}
                    onPress={() => verGastos(null, 'Sin categoría', '❓', 0)}
                  />
                )}
              </ListCard>
            )}
          </>
        )}
      </Section>

      {desv.porObjetivo.length > 0 && (
        <Section title="🐷 Ahorro para metas en este período">
          {desv.porObjetivo.map((o) => {
            const pct = o.esperado > 0 ? (o.real / o.esperado) * 100 : 0;
            const listo = o.real >= o.esperado;
            return (
              <GoalCard
                key={o.objetivoId}
                emoji={emojiMeta(o.objetivoId, preferencias.emojis.metas)}
                name={o.nombre}
                tag={listo ? `🎉 Ahorraste ${m(o.real - o.esperado)} de más` : `⏳ Te faltan ${m(o.esperado - o.real)}`}
                hint={porcentaje(pct)}
                pct={pct}
                ok={listo}
                footLeft={`Ahorraste ${m(o.real)} de ${m(o.esperado)}`}
                onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.objetivoId })}
              />
            );
          })}
        </Section>
      )}

      {abierto && (
        <MenuList
          items={[
            { title: 'Cambiar montos', emoji: '✏️', subtitle: 'Cuánto gastar, que entre y ahorrar', onPress: irAMontos },
            ...(puedeCerrar
              ? [
                  {
                    title: 'Cerrar presupuesto',
                    emoji: '🏁',
                    subtitle: 'Queda guardado para mirarlo después',
                    onPress: () =>
                      irAAccion(nav, {
                        titulo: 'Cerrar presupuesto',
                        explicacion: 'Se conserva para consultar la comparación con lo real.',
                        pregunta: '¿Por qué lo cierras?',
                        boton: 'Cerrar presupuesto',
                        comando: 'CerrarPresupuesto',
                        body: { presupuestoId },
                        aviso: 'Presupuesto cerrado',
                      }),
                  },
                ]
              : []),
          ]}
        />
      )}

      <ErrorText>{error}</ErrorText>
      <Button
        title="🗑️ Eliminar presupuesto"
        variant="danger"
        onPress={() =>
          irAAccion(nav, {
            titulo: 'Eliminar presupuesto',
            explicacion: 'Se borra para siempre, con su comparación. Úsalo solo si nunca debió existir.',
            pregunta: '¿Por qué lo eliminas?',
            boton: 'Eliminar presupuesto',
            comando: 'EliminarPresupuesto',
            body: { presupuestoId },
            aviso: 'Presupuesto eliminado',
            peligro: true,
            volver: 2,
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  barra: { marginTop: 12 },
  cifra: { fontSize: 14, fontWeight: '700' },
});
