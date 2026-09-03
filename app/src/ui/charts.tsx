import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Polyline, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors, Punto } from './index';

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
  const datos = segmentos.filter((s) => s.valor > 0);
  const total = datos.reduce((s, x) => s + x.valor, 0);
  const grosor = size * 0.16;
  const r = (size - grosor) / 2;
  const c = 2 * Math.PI * r;

  let acumulado = 0;

  return (
    <View style={styles.donaWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.faint}
            strokeWidth={grosor}
            fill="none"
          />
          {total > 0 &&
            datos.map((s, i) => {
              const frac = s.valor / total;
              const len = frac * c;
              const el = (
                <Circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={grosor}
                  fill="none"
                  strokeDasharray={`${len} ${c - len}`}
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
              fill={colors.text}
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
  color = colors.primary,
  formatoValor = (n) => n.toLocaleString('es-CL'),
}: {
  puntos: { etiqueta: string; valor: number }[];
  alto?: number;
  color?: string;
  formatoValor?: (n: number) => string;
}) {
  const ancho = 300;
  const padY = 14;
  if (puntos.length < 2) {
    return <Text style={styles.vacio}>Faltan puntos para el gráfico.</Text>;
  }

  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  const x = (i: number) => (i / (puntos.length - 1)) * ancho;
  const y = (v: number) => padY + (1 - (v - min) / rango) * (alto - 2 * padY);

  const coords = puntos.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ');
  const cero = min <= 0 && max >= 0 ? y(0) : null;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: alto }}>
        <Svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none">
          {cero != null && (
            <Line x1={0} y1={cero} x2={ancho} y2={cero} stroke={colors.border} strokeWidth={1} />
          )}
          <Polyline
            points={coords}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
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
  colorIngreso = colors.primary,
  colorGasto = colors.danger,
}: {
  barras: { etiqueta: string; ingresos: number; gastos: number }[];
  alto?: number;
  colorIngreso?: string;
  colorGasto?: string;
}) {
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
                  fill={colorIngreso}
                  rx={1}
                />
                <Rect
                  x={cx + 1}
                  y={alto - padY - h(b.gastos)}
                  width={anchoBarra}
                  height={h(b.gastos)}
                  fill={colorGasto}
                  rx={1}
                />
              </G>
            );
          })}
          <Line x1={0} y1={alto - padY} x2={ancho} y2={alto - padY} stroke={colors.border} strokeWidth={1} />
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
        <Punto color={colorIngreso} />
        <Text style={styles.ejeTxt}>Ingresos</Text>
        <Punto color={colorGasto} />
        <Text style={styles.ejeTxt}>Gastos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donaWrap: { flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  leyenda: { flex: 1, minWidth: 140, gap: 6 },
  leyendaFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leyendaLabel: { flex: 1, fontSize: 13, color: colors.text },
  leyendaValor: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  ejeFila: { flexDirection: 'row', justifyContent: 'space-between' },
  ejeTxt: { fontSize: 11, color: colors.muted },
  vacio: { fontSize: 13, color: colors.muted },
});
