import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Punto, useC } from './index';
import type { Paleta } from './tema';

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    donaWrap: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
    leyenda: { flex: 1, minWidth: 140, gap: 6 },
    leyendaFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    leyendaLabel: { flex: 1, fontSize: 13, color: c.text },
    leyendaValor: { fontSize: 12, color: c.muted, fontWeight: '600' },
    ejeFila: { flexDirection: 'row', justifyContent: 'space-between' },
    ejeTxt: { fontSize: 11, color: c.muted },
    vacio: { fontSize: 13, color: c.muted },
  });

function useCharts() {
  const c = useC();
  return { c, styles: useMemo(() => crearEstilos(c), [c]) };
}

export interface SegmentoDona {
  label: string;
  valor: number;
  color: string;
}

/**
 * Gráfico de dona (distribución). Muestra los segmentos > 0 y una leyenda con
 * el valor y el porcentaje de cada uno. `centro` va en el hueco (p. ej. el total).
 */
export function Dona({
  segmentos,
  centro,
  size = 160,
  formatoValor = (n) => n.toLocaleString('es-CL'),
}: {
  segmentos: SegmentoDona[];
  centro?: string;
  size?: number;
  formatoValor?: (n: number) => string;
}) {
  const { c, styles } = useCharts();
  const datos = segmentos.filter((s) => s.valor > 0);
  const total = datos.reduce((s, x) => s + x.valor, 0);
  const grosor = size * 0.16;
  const r = (size - grosor) / 2;
  const circ = 2 * Math.PI * r;

  let acumulado = 0;

  return (
    <View style={styles.donaWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={c.faint}
            strokeWidth={grosor}
            fill="none"
          />
          {total > 0 &&
            datos.map((s, i) => {
              const frac = s.valor / total;
              const len = frac * circ;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={grosor}
                  fill="none"
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-acumulado}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              acumulado += len;
              return el;
            })}
          {centro ? (
            <SvgText
              x={size / 2}
              y={size / 2}
              fontSize={size * 0.11}
              fontWeight="700"
              fill={c.text}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {centro}
            </SvgText>
          ) : null}
        </Svg>
      </View>

      <View style={styles.leyenda}>
        {datos.map((s, i) => (
          <View key={i} style={styles.leyendaFila}>
            <Punto color={s.color} />
            <Text style={styles.leyendaLabel} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={styles.leyendaValor}>
              {formatoValor(s.valor)}
              {total > 0 ? ` · ${Math.round((s.valor / total) * 100)}%` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Gráfico de línea simple para una serie temporal. `puntos` en orden; se
 * escala solo al alto/ancho dados. Muestra el valor mín/máx y las fechas
 * de los extremos.
 */
export function GraficoLinea({
  puntos,
  alto = 140,
  color,
  formatoValor = (n) => n.toLocaleString('es-CL'),
}: {
  puntos: { etiqueta: string; valor: number }[];
  alto?: number;
  color?: string;
  formatoValor?: (n: number) => string;
}) {
  const { c, styles } = useCharts();
  const [gradId] = useState(() => `glg-${Math.random().toString(36).slice(2)}`);
  const ancho = 300;
  const padY = 14;
  if (puntos.length < 2) {
    return <Text style={styles.vacio}>Faltan puntos para el gráfico.</Text>;
  }

  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const trazo = color ?? c.primary;

  const x = (i: number) => (i / (puntos.length - 1)) * ancho;
  const y = (v: number) => padY + (1 - (v - min) / rango) * (alto - 2 * padY);

  const coords = puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const cero = min <= 0 && max >= 0 ? y(0) : null;
  const ultimo = { x: x(puntos.length - 1), y: y(valores[valores.length - 1]) };
  // Área bajo la línea, desvanecida hacia abajo (look "rimu").
  const area = `M ${x(0)},${alto} L ${coords.split(' ').join(' L ')} L ${ultimo.x},${alto} Z`;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: alto }}>
        <Svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={trazo} stopOpacity={0.28} />
              <Stop offset="1" stopColor={trazo} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#${gradId})`} stroke="none" />
          {cero != null && (
            <Line x1={0} y1={cero} x2={ancho} y2={cero} stroke={c.border} strokeWidth={1} />
          )}
          <Polyline
            points={coords}
            fill="none"
            stroke={trazo}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle cx={ultimo.x} cy={ultimo.y} r={5} fill={trazo} fillOpacity={0.18} />
          <Circle cx={ultimo.x} cy={ultimo.y} r={2.5} fill={trazo} />
        </Svg>
      </View>
      <View style={styles.ejeFila}>
        <Text style={styles.ejeTxt}>{puntos[0].etiqueta}</Text>
        <Text style={styles.ejeTxt}>{puntos[puntos.length - 1].etiqueta}</Text>
      </View>
      <View style={styles.ejeFila}>
        <Text style={styles.ejeTxt}>mín {formatoValor(min)}</Text>
        <Text style={styles.ejeTxt}>máx {formatoValor(max)}</Text>
      </View>
    </View>
  );
}

/**
 * Barras mensuales pareadas (ingreso vs. gasto). `barras` en orden cronológico.
 */
export function GraficoBarras({
  barras,
  alto = 150,
  colorIngreso,
  colorGasto,
}: {
  barras: { etiqueta: string; ingresos: number; gastos: number }[];
  alto?: number;
  colorIngreso?: string;
  colorGasto?: string;
}) {
  const { c, styles } = useCharts();
  const cIngreso = colorIngreso ?? c.primary;
  const cGasto = colorGasto ?? c.danger;
  const ancho = 320;
  const padY = 8;
  const max = Math.max(1, ...barras.flatMap((b) => [b.ingresos, b.gastos]));
  const paso = ancho / barras.length;
  const anchoBarra = Math.min(10, paso / 3);
  const h = (v: number) => (v / max) * (alto - 2 * padY);

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: alto }}>
        <Svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none">
          {barras.map((b, i) => {
            const cx = i * paso + paso / 2;
            return (
              <G key={i}>
                <Rect
                  x={cx - anchoBarra - 1}
                  y={alto - padY - h(b.ingresos)}
                  width={anchoBarra}
                  height={h(b.ingresos)}
                  fill={cIngreso}
                  rx={1}
                />
                <Rect
                  x={cx + 1}
                  y={alto - padY - h(b.gastos)}
                  width={anchoBarra}
                  height={h(b.gastos)}
                  fill={cGasto}
                  rx={1}
                />
              </G>
            );
          })}
          <Line x1={0} y1={alto - padY} x2={ancho} y2={alto - padY} stroke={c.border} strokeWidth={1} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {barras.map((b, i) => (
          <Text key={i} style={[styles.ejeTxt, { flex: 1, textAlign: 'center' }]}>
            {b.etiqueta}
          </Text>
        ))}
      </View>
      <View style={styles.leyendaFila}>
        <Punto color={cIngreso} />
        <Text style={styles.ejeTxt}>Ingresos</Text>
        <Punto color={cGasto} />
        <Text style={styles.ejeTxt}>Gastos</Text>
      </View>
    </View>
  );
}
