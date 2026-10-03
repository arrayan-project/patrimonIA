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
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Button,
  colorCategoria,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Row,
  Screen,
  Title,
  Skeleton,
  Panel,
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
  const toast = useToast();
  const presupuestoId = nav.route.params?.presupuestoId as string;

  const [p, setP] = useState<PresupuestoDTO | null>(null);
  const [desv, setDesv] = useState<DesviacionPresupuestariaDTO | null>(null);
  const [error, setError] = useState('');

  const [modo, setModo] = useState<null | 'editar' | 'cerrar' | 'eliminar'>(null);
  const [ingresos, setIngresos] = useState('');
  const [gastos, setGastos] = useState('');
  const [ahorro, setAhorro] = useState('');
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [presu, desviacion] = await Promise.all([
        api.get<PresupuestoDTO>(`/presupuestos/${presupuestoId}`, token),
        api.get<DesviacionPresupuestariaDTO>(`/presupuestos/${presupuestoId}/desviacion`, token),
      ]);
      setP(presu);
      setDesv(desviacion);
      setIngresos(presu.ingresosEsperados == null ? '' : String(presu.ingresosEsperados));
      setGastos(presu.gastosEsperados == null ? '' : String(presu.gastosEsperados));
      setAhorro(presu.ahorroEsperado == null ? '' : String(presu.ahorroEsperado));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [presupuestoId, token]);

  useCargaAlEnfocar(cargar);

  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const ejecutar = async () => {
    setBusy(true);
    setError('');
    try {
      if (modo === 'editar') {
        const body: Record<string, unknown> = { presupuestoId };
        if (num(ingresos) !== undefined) body.ingresosEsperados = num(ingresos);
        if (num(gastos) !== undefined) body.gastosEsperados = num(gastos);
        if (num(ahorro) !== undefined) body.ahorroEsperado = num(ahorro);
        await api.post('/comandos/ActualizarDatosPresupuesto', body, token);
        toast.mostrar('Guardado');
        setModo(null);
        await cargar();
      } else if (modo === 'cerrar') {
        await api.post('/comandos/CerrarPresupuesto', { presupuestoId, motivo: motivo.trim() }, token);
        toast.mostrar('Presupuesto cerrado');
        setModo(null);
        await cargar();
      } else {
        if (!(await confirmar('Eliminar presupuesto', 'Se borra de forma definitiva, junto con su comparación presupuesto-vs-real.', 'Eliminar'))) {
          setBusy(false);
          return;
        }
        await api.post('/comandos/EliminarPresupuesto', { presupuestoId, motivo: motivo.trim() }, token);
        toast.mostrar('Presupuesto eliminado');
        nav.back();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <Screen onRefresh={cargar}>
      <Title>Presupuesto {etiqueta(p.tipo).toLowerCase()}</Title>

      <Panel>
        <Row left="Periodicidad" right={etiqueta(p.periodicidad)} />
        {p.intervalo && <Row left="Intervalo" right={etiqueta(p.intervalo)} />}
        <Row
          left="Período"
          right={`${p.fechaInicio ? fechaLegible(p.fechaInicio) : '—'} → ${p.fechaFin ? fechaLegible(p.fechaFin) : '—'}`}
        />
        <Row
          left="Estado"
          right={p.estado ? etiqueta(p.estado) : p.vigente ? 'Vigente (calendario)' : 'Fuera de vigencia'}
        />
      </Panel>

      <Panel>
        <Text style={styles.sectionTitle}>Presupuestado vs. real</Text>
        <Row left="Ingresos esperados" right={money(desv.esperado.ingresos, p.moneda)} />
        <Row left="Ingresos reales" right={money(desv.real.ingresos, p.moneda)} />
        <Row left="Desviación ingresos" right={sign(desv.desviacion.ingresos)} />
        <View style={styles.sep} />
        <Row left="Gastos esperados" right={money(desv.esperado.gastos, p.moneda)} />
        <Row left="Gastos reales" right={money(desv.real.gastos, p.moneda)} />
        <Row left="Desviación gastos" right={sign(desv.desviacion.gastos)} />
        <View style={styles.sep} />
        <Row left="Ahorro esperado" right={money(desv.esperado.ahorro, p.moneda)} />
        <Row left="Ahorro real" right={money(desv.real.ahorro, p.moneda)} />
        <Row left="Desviación ahorro" right={sign(desv.desviacion.ahorro)} />
      </Panel>

      <Panel>
        <View style={styles.filaTitulo}>
          <Text style={styles.sectionTitle}>Por rubro</Text>
          {p.estado !== 'CERRADO' && (
            <LinkButton
              title="Editar rubros"
              onPress={() => nav.go('PresupuestoRubros', { presupuestoId })}
            />
          )}
        </View>

        {desv.porRubro.length === 0 && desv.sinClasificar.gastos === 0 ? (
          <Text style={styles.muted}>
            Sin rubros. Define cuánto esperas por categoría para seguir el gasto en detalle.
          </Text>
        ) : (
          <>
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
                  <Text
                    style={[styles.muted, { color: r.desviacion > 0 ? c.danger : c.muted }]}
                  >
                    {sign(r.desviacion)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </Panel>

      {desv.porObjetivo.length > 0 && (
        <Panel>
          <Text style={styles.sectionTitle}>Ahorro por meta</Text>
          {desv.porObjetivo.map((o) => (
            <View key={o.objetivoId} style={styles.rubro}>
              <Text style={styles.rubroTexto}>{o.nombre}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rubroTexto}>
                  {money(o.real, p.moneda)} / {money(o.esperado, p.moneda)}
                </Text>
                <Text style={[styles.muted, { color: o.desviacion < 0 ? c.danger : c.muted }]}>
                  {sign(o.desviacion)}
                </Text>
              </View>
            </View>
          ))}
        </Panel>
      )}

      {modo === null && (
        <View style={{ gap: 8 }}>
          {p.estado !== 'CERRADO' && (
            <Button title="Editar montos esperados" onPress={() => setModo('editar')} />
          )}
          {puedeCerrar && (
            <Button title="Cerrar presupuesto" variant="secondary" onPress={() => setModo('cerrar')} />
          )}
          <Button title="Eliminar presupuesto" variant="danger" onPress={() => setModo('eliminar')} />
        </View>
      )}

      {modo === 'editar' && (
        <Panel>
          <Text style={styles.sectionTitle}>Editar montos esperados</Text>
          <MoneyField label="Ingresos" value={ingresos} onChange={setIngresos} />
          <MoneyField label="Gastos" value={gastos} onChange={setGastos} />
          <MoneyField label="Ahorro" value={ahorro} onChange={setAhorro} />
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar" onPress={ejecutar} loading={busy} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {(modo === 'cerrar' || modo === 'eliminar') && (
        <Panel>
          <Text style={styles.sectionTitle}>
            {modo === 'cerrar' ? 'Cerrar presupuesto' : 'Eliminar presupuesto'}
          </Text>
          <Text style={styles.muted}>
            {modo === 'cerrar'
              ? 'Se conserva para consultar la comparación presupuesto-vs-real.'
              : 'Borrado definitivo. Úsalo solo si el presupuesto nunca debió existir.'}
          </Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button
            title={modo === 'cerrar' ? 'Cerrar' : 'Eliminar'}
            onPress={ejecutar}
            loading={busy}
            disabled={motivo.trim().length < 3}
          />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === null && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
  muted: tipoDe(c).nota,
  sep: { height: 1, backgroundColor: c.faint, marginVertical: 4 },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rubro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: c.faint,
    paddingTop: 8,
  },
  rubroNombre: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rubroTexto: { fontSize: 14, color: c.text, fontWeight: '600' },
});
