import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type DesviacionPresupuestariaDTO,
  type PresupuestoDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import {
  AccionDestructiva,
  Button,
  colorCategoria,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  fechaLegible,
  Hero,
  Nota,
  Panel,
  Screen,
  Section,
  Skeleton,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';
import { Dona } from '../ui/charts';

export function PresupuestoDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const presupuestoId = nav.route.params?.presupuestoId as string;

  const [p, setP] = useState<PresupuestoDTO | null>(null);
  const [desv, setDesv] = useState<DesviacionPresupuestariaDTO | null>(null);
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [presupuestoId, token]);

  useCargaAlEnfocar(cargar);

  useTitulo(p ? `Presupuesto ${etiqueta(p.tipo).toLowerCase()}` : undefined);
  const abierto = !!p && p.estado !== 'CERRADO';
  useAccionHeader(
    'Editar',
    abierto && p
      ? () =>
          nav.go('PresupuestoForm', {
            presupuestoId,
            ingresos: p.ingresosEsperados,
            gastos: p.gastosEsperados,
            ahorro: p.ahorroEsperado,
            moneda: p.moneda,
          })
      : undefined,
  );

  if (!p || !desv) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const sign = (n: number) => (n > 0 ? `+${money(n, p.moneda)}` : money(n, p.moneda));
  const puedeCerrar = p.periodicidad === 'ESPECIFICO' && p.estado === 'ACTIVO';

  const rubrosGasto = desv.porRubro.filter((r) => r.tipoAplicable !== 'INGRESO');
  const segmentos = [
    ...rubrosGasto.map((r, i) => ({
      label: r.nombre,
      valor: r.real,
      color: colorCategoria(r.color, i),
    })),
    { label: 'Sin clasificar', valor: desv.sinClasificar.gastos, color: c.muted },
  ];
  const rubrosConMeta = desv.porRubro.filter((r) => r.esperado > 0);

  const vs = (real: number, esperado: number) => `${money(real, p.moneda)} de ${money(esperado, p.moneda)}`;

  return (
    <Screen
      onRefresh={cargar}
      pie={
        abierto ? (
          <>
            <Button title="Editar rubros" onPress={() => nav.go('PresupuestoRubros', { presupuestoId })} />
            {puedeCerrar && (
              <Button
                title="Cerrar presupuesto"
                variant="secondary"
                onPress={() =>
                  irAAccion(nav, {
                    titulo: 'Cerrar presupuesto',
                    explicacion: 'Se conserva para consultar la comparación con lo real.',
                    pregunta: '¿Por qué lo cierras?',
                    boton: 'Cerrar presupuesto',
                    comando: 'CerrarPresupuesto',
                    body: { presupuestoId },
                    aviso: 'Presupuesto cerrado',
                  })
                }
              />
            )}
          </>
        ) : undefined
      }
    >
      <Hero
        label="Gastado"
        value={money(desv.real.gastos, p.moneda)}
        substats={[
          { label: 'Presupuesto', value: money(desv.esperado.gastos, p.moneda) },
          { label: desv.desviacion.gastos > 0 ? 'Te pasaste' : 'Te queda', value: money(Math.abs(desv.desviacion.gastos), p.moneda) },
        ]}
      />

      <Datos>
        <Dato
          etiqueta="Período"
          valor={
            p.periodicidad === 'PERIODICO'
              ? etiqueta(p.intervalo ?? '')
              : `${p.fechaInicio ? fechaLegible(p.fechaInicio) : '—'} → ${p.fechaFin ? fechaLegible(p.fechaFin) : '—'}`
          }
        />
        <Dato etiqueta="Estado" valor={p.estado ? etiqueta(p.estado) : p.vigente ? 'Vigente' : 'Fuera de vigencia'} />
        <Dato etiqueta="Ingresos" valor={vs(desv.real.ingresos, desv.esperado.ingresos)} />
        <Dato etiqueta="Ahorro" valor={vs(desv.real.ahorro, desv.esperado.ahorro)} />
      </Datos>

      <Section title="Por rubro">
        {desv.porRubro.length === 0 && desv.sinClasificar.gastos === 0 ? (
          <Nota>Sin rubros. Define cuánto esperas por categoría para seguir el gasto en detalle.</Nota>
        ) : (
          <Panel>
            {segmentos.some((s) => s.valor > 0) && (
              <Dona
                segmentos={segmentos}
                centro={money(desv.real.gastos, p.moneda).replace(` ${p.moneda}`, '')}
                formatoValor={(n) => money(n, p.moneda)}
              />
            )}
            {rubrosConMeta.map((r) => (
              <Pressable
                key={r.categoriaId}
                style={({ pressed }) => [styles.rubro, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Ver movimientos de ${r.nombre}`}
                onPress={() =>
                  nav.irATab('Movimientos', {
                    categoriaId: r.categoriaId,
                    categoriaNombre: r.nombre,
                    mes: desv.periodo.desde ?? undefined,
                  })
                }
              >
                <Text style={styles.rubroTexto}>{r.nombre} ›</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rubroTexto}>
                    {money(r.real, p.moneda)} / {money(r.esperado, p.moneda)}
                  </Text>
                  <Text style={[styles.muted, { color: r.desviacion > 0 ? c.danger : c.muted }]}>
                    {sign(r.desviacion)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Panel>
        )}
      </Section>

      {desv.porObjetivo.length > 0 && (
        <Section title="Ahorro por meta">
          <Datos>
            {desv.porObjetivo.map((o) => (
              <Dato key={o.objetivoId} etiqueta={o.nombre} valor={vs(o.real, o.esperado)} />
            ))}
          </Datos>
        </Section>
      )}

      <ErrorText>{error}</ErrorText>
      <AccionDestructiva
        title="Eliminar presupuesto"
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

const crearEstilos = (c: Paleta) => StyleSheet.create({
  muted: tipoDe(c).nota,
  rubro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: c.faint,
    paddingTop: 8,
  },
  rubroTexto: { fontSize: 14, color: c.text, fontWeight: '600' },
});
