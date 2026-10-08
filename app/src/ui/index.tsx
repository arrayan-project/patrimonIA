import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { etiqueta } from '../labels';
import { CLARO, radio, tipografia, useC, type Paleta } from './tema';
import { useToast } from './Toast';

export type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];

export { etiqueta, humanizar, accionAuditoria } from '../labels';
export { TemaProvider, useC, useTema, radio, tipografia, type Paleta, type ModoTema } from './tema';

/** Paleta activa memoizada + estilos derivados. Para los componentes de este archivo. */
function useEstilos() {
  const c = useC();
  return useMemo(() => crearEstilos(c), [c]);
}

// ── Helpers de formato ──────────────────────────────────────────────────────

/** Date → 'YYYY-MM-DD' en hora local (no UTC). */
export function aISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Preferencia del usuario (G25): "15 mar 2026" o "15-03-2026". La fija PreferenciasProvider. */
export type FormatoFecha = 'legible' | 'numerico';
let formatoFecha: FormatoFecha = 'legible';
export function setFormatoFecha(f: FormatoFecha): void {
  formatoFecha = f;
}

/** 'YYYY-MM-DD' → "15 mar 2026" (o "15-03-2026" según la preferencia). Devuelve el string tal cual si no parsea. */
export function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  if (formatoFecha === 'numerico') return `${m[3]}-${m[2]}-${m[1]}`;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Fecha en lenguaje natural para lo reciente ("hoy", "ayer", "hace 3 días"),
 * y `fechaLegible()` para lo que queda más lejos. Acepta ISO date o datetime.
 */
export function fechaRelativa(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dias = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias === -1) return 'mañana';
  if (dias > 1 && dias < 7) return `hace ${dias} días`;
  if (dias < -1 && dias > -7) return `en ${-dias} días`;
  return fechaLegible(iso.slice(0, 10));
}

function agruparMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** '#rrggbb' + alpha → 'rgba(r,g,b,a)'. Para rellenos translúcidos (pills de signo). */
export function tinte(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

/**
 * @deprecated Paleta clara estática. En componentes usa `useC()` para que
 * respete el modo oscuro; esto queda solo para código aún sin migrar.
 */
export const colors = CLARO;

/**
 * @deprecated El rediseño monocromo es plano — sin sombras, la separación la
 * dan el borde y el espacio. Se mantiene como no-op para imports antiguos.
 */
export const sombra = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

/** Escala de espaciado (múltiplos de 4). Usar para `gap` / `margin` / `padding`. */
export const escala = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Contenedor tipo tarjeta (panel con borde sutil). Fuente única del "look" de
 * tarjeta. El `gap` interno lo pone `Panel` o cada pantalla.
 */
export const panelDe = (c: Paleta) =>
  ({
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radio.tarjeta,
    padding: escala.lg,
  }) as const;
/** @deprecated usa `panelDe(useC())` o el componente `<Panel>`. */
export const panel = panelDe(CLARO);

/**
 * Escala tipográfica. `titulo` = `<Title>`, `seccion` = encabezado de tarjeta,
 * `dato` = valor de una fila, `nota` = texto secundario (13px), `cuerpo` = texto
 * corrido (15px).
 */
export const tipoDe = (c: Paleta) =>
  ({
    titulo: { fontSize: 24, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
    seccion: { fontSize: 16, fontWeight: '700', color: c.text },
    cuerpo: { fontSize: 15, color: c.text, lineHeight: 22 },
    dato: { fontSize: 14, color: c.text, fontWeight: '600' },
    nota: { fontSize: 13, color: c.muted, lineHeight: 19 },
  }) as const;
/** @deprecated usa `tipoDe(useC())`. */
export const tipo = tipoDe(CLARO);

/**
 * Contenedor scrollable de cada pantalla. Si se pasa `onRefresh`, habilita
 * "deslizar para actualizar" (y gestiona su propio estado de spinner).
 */
export function Screen({
  children,
  onRefresh,
  fab,
  pie,
}: {
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
  /** Botón flotante fijo (no scrollea) abajo a la derecha. */
  fab?: ReactNode;
  /**
   * Pie fijo bajo el contenido (no scrollea): la frase de resumen y la acción
   * principal de un Formulario, o la acción principal de un Detalle.
   */
  pie?: ReactNode;
}) {
  const c = useC();
  const styles = useEstilos();
  const insets = useSafeAreaInsets();
  const alturaHeader = useContext(HeaderHeightContext);
  const conHeader = typeof alturaHeader === 'number' && alturaHeader > 0;
  const [refrescando, setRefrescando] = useState(false);

  const alRefrescar = async () => {
    setRefrescando(true);
    try {
      await onRefresh?.();
    } finally {
      setRefrescando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.screenContent,
          {
            paddingTop: conHeader ? 16 : 20 + insets.top,
            paddingBottom: 24 + (conHeader && !pie ? insets.bottom : 0) + (fab ? 72 : 0),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={c.primary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {pie ? (
        <View style={[styles.pie, { paddingBottom: 14 + (conHeader ? insets.bottom : 0) }]}>{pie}</View>
      ) : null}
      {fab ? (
        <View
          style={[
            styles.fabWrap,
            { bottom: insets.bottom + (conHeader ? 20 : 72) },
          ]}
        >
          {fab}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Botón de acción flotante. Se pasa a `<Screen fab={...}>`. */
export function FAB({ icon, onPress }: { icon: NombreIcono; onPress: () => void }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={c.primaryText} />
    </Pressable>
  );
}

export type AccionHoja = { icon: NombreIcono; label: string; subtitle?: string; onPress: () => void };

/**
 * Hoja con varias acciones (la del "+", p. ej. "¿Qué quieres anotar?"). La usa
 * `FabMenu` y cualquier botón que deba abrir el mismo menú.
 */
export function HojaAcciones({
  visible,
  onClose,
  titulo,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  /** Pregunta arriba de la hoja (p. ej. "¿Qué quieres anotar?"). */
  titulo?: string;
  actions: AccionHoja[];
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalFondo} onPress={onClose}>
        <Pressable style={styles.modalHoja} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
          <View style={styles.agarre} />
          {titulo ? <Text style={styles.modalTitulo}>{titulo}</Text> : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.subtitle ? `${a.label}. ${a.subtitle}` : a.label}
              style={({ pressed }) => [styles.fabAction, pressed && { backgroundColor: c.bg }]}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            >
              <View style={styles.fabActionIc}>
                <Ionicons name={a.icon} size={20} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fabActionTxt}>{a.label}</Text>
                {a.subtitle ? <Text style={styles.fabActionSub}>{a.subtitle}</Text> : null}
              </View>
            </Pressable>
          ))}
          <LinkButton title="Cancelar" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * FAB que abre una hoja con varias acciones. Para cuando el "+" no es una sola
 * cosa (registrar un movimiento — frecuente — vs. agregar una cuenta — raro).
 */
export function FabMenu({ titulo, actions }: { titulo?: string; actions: AccionHoja[] }) {
  const c = useC();
  const styles = useEstilos();
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Crear"
      >
        <Ionicons name="add" size={28} color={c.primaryText} />
      </Pressable>
      <HojaAcciones visible={abierto} onClose={() => setAbierto(false)} titulo={titulo} actions={actions} />
    </>
  );
}

/** Toggle compacto de 2 opciones para una barra superior (p. ej. Míos / Del hogar). */
export function PillToggle<T extends string>({
  options,
  value,
  onChange,
  format = (v) => v,
}: {
  options: readonly [T, T];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const styles = useEstilos();
  return (
    <View style={styles.pillToggle}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === opt }}
          style={[styles.pillToggleOpt, value === opt && styles.pillToggleOptActive]}
        >
          <Text style={[styles.pillToggleTxt, value === opt && styles.pillToggleTxtActive]}>
            {format(opt)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

/**
 * Migaja de contexto: dice a qué entidad "padre" pertenece lo que se está
 * viendo (p. ej. "Cuenta corriente" arriba del detalle de un movimiento).
 */
export function Migaja({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.migaja}>
      <Ionicons name="chevron-back" size={13} color={c.muted} />
      <Text style={styles.migajaTexto} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Fila superior de una pantalla-hub: pill de contexto a la izquierda, acciones
 * (íconos circulares) a la derecha. Patrón "top-row" del rediseño.
 */
export function TopRow({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  const styles = useEstilos();
  return (
    <View style={styles.topRow}>
      <View style={styles.topRowSide}>{left}</View>
      <View style={styles.topActions}>{right}</View>
    </View>
  );
}

/** Pill redondeado de fecha / contexto / filtro. */
export function PillDate({ icon, children }: { icon?: NombreIcono; children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.pillDate}>
      {icon ? <Ionicons name={icon} size={13} color={c.muted} /> : null}
      <Text style={styles.pillDateTxt} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/** Botón de ícono circular (34px). `badge` pinta un punto con número. */
export function IconButton({
  icon,
  badge,
  onPress,
  accessibilityLabel,
}: {
  icon: NombreIcono;
  badge?: number;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={16} color={c.text} />
      {badge ? (
        <View style={styles.iconBtnBadge}>
          <Text style={styles.iconBtnBadgeTxt}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * "Hero" de una métrica: label en mayúsculas, número gigante, pill de cambio
 * opcional, sub-stats y un slot (`children`) para una curva/sparkline debajo.
 * Firma visual del rediseño (patrón "Balance" de Rimu).
 */
export function Hero({
  label,
  value,
  change,
  changeDir,
  substats,
  children,
}: {
  label: string;
  value: ReactNode;
  change?: string;
  changeDir?: 'pos' | 'neg';
  substats?: { label: string; value: string }[];
  children?: ReactNode;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.hero}>
      <Text style={styles.heroLbl}>{label}</Text>
      <View style={styles.heroRow}>
        {typeof value === 'string' ? <Text style={styles.heroVal}>{value}</Text> : value}
        {change ? (
          <Text
            style={[
              styles.heroChg,
              {
                color: changeDir === 'neg' ? c.danger : c.ok,
                backgroundColor: tinte(changeDir === 'neg' ? c.danger : c.ok, 0.15),
              },
            ]}
          >
            {change}
          </Text>
        ) : null}
      </View>
      {substats && substats.length > 0 ? (
        <View style={styles.heroSubs}>
          {substats.map((s, i) => (
            <Text key={i} style={styles.heroSub}>
              {s.label} <Text style={styles.heroSubB}>{s.value}</Text>
            </Text>
          ))}
        </View>
      ) : null}
      {children ? <View style={styles.heroChart}>{children}</View> : null}
    </View>
  );
}

/** Fila de accesos rápidos: íconos circulares con etiqueta corta debajo. */
export function QuickActions({
  items,
}: {
  items: { icon: NombreIcono; label: string; onPress: () => void }[];
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.quickRow}>
      {items.map((it, i) => (
        <Pressable
          key={i}
          onPress={it.onPress}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.quickIc}>
            <Ionicons name={it.icon} size={18} color={c.text} />
          </View>
          <Text style={styles.quickTxt}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Fila de transacción: logo cuadrado de color, título + subtítulo, monto a la
 * derecha (verde si `positivo`). `virtual` la marca como reserva/proyección
 * (logo con borde punteado + etiqueta discreta).
 */
export function TxRow({
  title,
  subtitle,
  amount,
  positivo,
  negativo,
  logo,
  virtual,
  tag,
  accesorio,
  onPress,
}: {
  title: string;
  subtitle?: string;
  amount: string;
  positivo?: boolean;
  /** Monto en rojo (deuda, saldo en contra). */
  negativo?: boolean;
  logo?: { icon?: NombreIcono; text?: string; color?: string };
  virtual?: boolean;
  tag?: string;
  /** Controles al final de la fila (p. ej. ▲▼ para ordenar un catálogo). */
  accesorio?: ReactNode;
  onPress?: () => void;
}) {
  const c = useC();
  const styles = useEstilos();
  // Sobre un color propio, el ícono va en blanco; sobre el gris de la fila, en el color del texto.
  const tinta = virtual ? c.muted : logo?.color ? '#fff' : c.text;
  const cuerpo = (
    <>
      <View
        style={[
          styles.txLogo,
          virtual
            ? { backgroundColor: c.panelAlt, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' }
            : { backgroundColor: logo?.color ?? c.panelAlt },
        ]}
      >
        {logo?.icon ? (
          <Ionicons name={logo.icon} size={17} color={tinta} />
        ) : (
          <Text style={[styles.txLogoTxt, { color: tinta }]}>
            {(logo?.text ?? title).slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.txMain}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle || tag ? (
          <Text style={styles.txSub} numberOfLines={1}>
            {tag ? <Text style={styles.txTag}>{tag}</Text> : null}
            {tag && subtitle ? ' · ' : ''}
            {subtitle}
          </Text>
        ) : null}
      </View>
      {amount ? (
        <Text style={[styles.txAmt, positivo && { color: c.ok }, negativo && { color: c.danger }]}>{amount}</Text>
      ) : null}
      {accesorio}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.txRow, pressed && { opacity: 0.6 }]}
      >
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={styles.txRow}>{cuerpo}</View>;
}

/**
 * Tarjeta de objetivo / meta: nombre + pista a la derecha (días, %), barra de
 * progreso fina y pie con montos. `ok` pinta la barra en verde.
 */
export function GoalCard({
  name,
  hint,
  pct,
  footLeft,
  footRight,
  ok,
  accion,
  onPress,
}: {
  name: string;
  hint?: string;
  pct: number;
  footLeft?: string;
  footRight?: string;
  ok?: boolean;
  /** Botón chico al pie, a la derecha (p. ej. "Ahorrar"); reemplaza a `footRight`. */
  accion?: { label: string; onPress: () => void };
  onPress?: () => void;
}) {
  const c = useC();
  const styles = useEstilos();
  const w = `${Math.max(0, Math.min(100, pct))}%` as const;
  const cuerpo = (
    <>
      <View style={styles.goalTop}>
        <Text style={styles.goalName} numberOfLines={1}>
          {name}
        </Text>
        {hint ? <Text style={[styles.goalHint, ok && { color: c.ok }]}>{hint}</Text> : null}
      </View>
      <View style={styles.goalBar}>
        <View style={[styles.goalBarFill, { width: w, backgroundColor: ok ? c.ok : c.text }]} />
      </View>
      {footLeft || footRight || accion ? (
        <View style={styles.goalFoot}>
          <Text style={styles.goalFootTxt}>{conMontos(footLeft, styles.goalFootMonto)}</Text>
          {accion ? (
            <Pressable
              onPress={accion.onPress}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${accion.label} en ${name}`}
              style={({ pressed }) => [styles.goalBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.goalBtnTxt}>{accion.label}</Text>
            </Pressable>
          ) : (
            <Text style={[styles.goalFootTxt, ok && { color: c.ok }]}>{conMontos(footRight, styles.goalFootMonto)}</Text>
          )}
        </View>
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.goalCard, pressed && { opacity: 0.7 }]}
      >
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={styles.goalCard}>{cuerpo}</View>;
}

/** Pone en negrita los montos (`money()`: "150.000 CLP") dentro de un texto. */
function conMontos(texto: string | undefined, estilo: TextStyle): ReactNode {
  if (!texto) return texto;
  return texto.split(/(-?[\d.,]+ [A-Z]{3})/).map((t, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={estilo}>
        {t}
      </Text>
    ) : (
      t
    ),
  );
}

/**
 * Tarjeta única con filas (`TxRow`) separadas por una línea, como
 * las listas del prototipo. La línea de la última fila queda oculta.
 */
export function ListCard({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  return (
    <View style={styles.listCard}>
      <View style={{ marginBottom: -1 }}>{children}</View>
    </View>
  );
}

/** Rejilla de mini-métricas (2 columnas). */
export function MiniGrid({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  return <View style={styles.miniGrid}>{children}</View>;
}

/** Panel de una métrica dentro de `<MiniGrid>`. Con `onPress`, es tocable. */
export function MiniPanel({
  label,
  value,
  sub,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'ok' | 'danger';
  onPress?: () => void;
}) {
  const c = useC();
  const styles = useEstilos();
  const color = tone === 'ok' ? c.ok : tone === 'danger' ? c.danger : c.text;
  const cuerpo = (
    <>
      <Text style={styles.miniLbl}>{label}</Text>
      <Text style={[styles.miniVal, { color }]}>{value}</Text>
      {sub ? <Text style={styles.miniSub}>{sub}</Text> : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={13} color={c.mutedDim} style={styles.miniChev} />
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.miniPanel, pressed && { opacity: 0.7 }]}
      >
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={styles.miniPanel}>{cuerpo}</View>;
}

/**
 * Tarjeta blanca con borde. Si se pasa `onPress`, es tocable y muestra un
 * chevron "ver más" a la derecha. `franja` pinta una barra de color a la izq.
 */
export function Card({
  children,
  onPress,
  franja,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  franja?: string;
  style?: object;
}) {
  const c = useC();
  const styles = useEstilos();
  const contenido = (
    <>
      {franja ? <View style={[styles.cardFranja, { backgroundColor: franja }]} /> : null}
      <View style={{ flex: 1, gap: 8 }}>{children}</View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, styles.cardRow, pressed && styles.cardPressed, style]}
      >
        {contenido}
      </Pressable>
    );
  }
  return <View style={[styles.card, styles.cardRow, style]}>{contenido}</View>;
}

/**
 * Contenedor de contenido en tarjeta (vertical, no tocable). `gap` controla la
 * separación entre hijos.
 */
export function Panel({
  children,
  gap = escala.sm,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: object;
}) {
  const c = useC();
  return <View style={[panelDe(c), { gap }, style]}>{children}</View>;
}

/** Encabezado de una tarjeta / sección de contenido. */
export function SectionTitle({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/**
 * Sección de una pantalla (patrón del prototipo): título corto en mayúsculas
 * y, a la derecha, un enlace "Ver todos" que lleva a la lista completa. El
 * contenido (una tarjeta, varias metas) va como `children`.
 */
export function Section({
  title,
  accion = 'Ver todos',
  onAccion,
  children,
}: {
  title: string;
  accion?: string;
  onAccion?: () => void;
  children?: ReactNode;
}) {
  const styles = useEstilos();
  return (
    <View style={styles.seccion}>
      <View style={styles.seccionCabeza}>
        <Text style={styles.rotulo} accessibilityRole="header">
          {title}
        </Text>
        {onAccion ? (
          <Pressable onPress={onAccion} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${accion}: ${title}`}>
            <Text style={styles.seccionAccion}>{accion}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Texto secundario corto (13px, gris). Para pies de tarjeta y aclaraciones. */
export function Nota({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  return <Text style={styles.nota}>{children}</Text>;
}

/** Métrica destacada: valor grande + etiqueta + pista opcional. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  const styles = useEstilos();
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.nota}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.statValue}>{value}</Text> : value}
      {hint ? <Text style={styles.nota}>{hint}</Text> : null}
    </View>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  return <Text style={styles.paragraph}>{children}</Text>;
}

/** Estado de una pregunta numerada (HZ-24). */
export type EstadoPaso = 'hecho' | 'actual' | 'bloqueado';
export type Paso = number | { n: number; estado: EstadoPaso };

/**
 * Numera las preguntas de un formulario (HZ-19) y marca en cuál va el usuario
 * (HZ-24). Se crea en cada render y se llama en el orden del JSX: un campo
 * oculto no consume número, así que no quedan saltos. El paso actual es el
 * primer obligatorio sin completar (un opcional nunca lo es, y un valor ya
 * puesto cuenta como hecho); todo lo que viene después queda bloqueado. Sin
 * argumentos, la pregunta se trata como opcional.
 */
export function contadorPasos(): (p?: { hecho?: boolean; opcional?: boolean }) => Paso {
  let n = 0;
  let hayActual = false;
  return (p) => {
    const hecho = p?.hecho ?? false;
    const opcional = p === undefined ? true : (p.opcional ?? false);
    n += 1;
    if (hayActual) return { n, estado: 'bloqueado' };
    if (opcional || hecho) return { n, estado: 'hecho' };
    hayActual = true;
    return { n, estado: 'actual' };
  };
}

const estadoDe = (paso?: Paso): EstadoPaso | undefined =>
  paso != null && typeof paso === 'object' ? paso.estado : undefined;

// Un BloquePaso dentro de otro (p. ej. un grupo con su campo) no repite el efecto.
const DentroDePaso = createContext(false);

/**
 * Envuelve lo que pertenece a una pregunta numerada (HZ-24): el paso actual
 * lleva una barra a la izquierda; uno bloqueado se atenúa y no responde al
 * toque (no es un error). Sin `paso`, no hace nada.
 */
export function BloquePaso({
  paso,
  style,
  children,
}: {
  paso?: Paso;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const styles = useEstilos();
  const dentro = useContext(DentroDePaso);
  const estado = dentro ? undefined : estadoDe(paso);
  return (
    <DentroDePaso.Provider value={dentro || estado != null}>
      <View
        style={[
          style,
          estado && styles.bloquePaso,
          estado === 'actual' && styles.bloquePasoActual,
          estado === 'bloqueado' && styles.bloquePasoBloqueado,
        ]}
        accessibilityState={estado === 'bloqueado' ? { disabled: true } : undefined}
      >
        {children}
      </View>
    </DentroDePaso.Provider>
  );
}

const SUFIJO_OPCIONAL = /\s*\(opcional\)$/i;

/**
 * Pregunta de un formulario en lenguaje natural ("¿Cuánto?", "¿Desde qué
 * cuenta pagaste?"), patrón del prototipo en vez de una etiqueta seca. Con
 * `paso`, conserva delante su número (HZ-19), invertido si es el actual
 * (HZ-24): el prototipo no numera, pero ganan los HZ. "(opcional)" —como
 * prop o al final del texto— se muestra atenuado.
 */
export function Question({
  paso,
  opcional,
  children,
}: {
  paso?: Paso;
  opcional?: boolean;
  children: ReactNode;
}) {
  const styles = useEstilos();
  const sufijo = typeof children === 'string' && SUFIJO_OPCIONAL.test(children);
  const texto = sufijo ? (children as string).replace(SUFIJO_OPCIONAL, '') : children;
  const cuerpo = (
    <Text style={[styles.label, { flexShrink: 1 }]}>
      {texto}
      {opcional || sufijo ? <Text style={styles.labelOpcional}> (opcional)</Text> : null}
    </Text>
  );
  if (paso == null) return cuerpo;
  const n = typeof paso === 'object' ? paso.n : paso;
  const actual = estadoDe(paso) === 'actual';
  return (
    <View style={styles.etiquetaPaso}>
      <View
        style={[styles.numeroPaso, actual && styles.numeroPasoActual]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Text style={[styles.numeroPasoTexto, actual && styles.numeroPasoTextoActual]}>{n}</Text>
      </View>
      {cuerpo}
    </View>
  );
}

/** @deprecated nombre anterior de `Question`. */
export const Etiqueta = Question;

export function Field({
  label,
  error,
  paso,
  ...props
}: TextInputProps & { label: string; error?: string; paso?: Paso }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <BloquePaso paso={paso} style={styles.field}>
      {label ? <Question paso={paso}>{label}</Question> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={c.mutedDim}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
    </BloquePaso>
  );
}

/**
 * Campo de fecha con calendario nativo. `value` es 'YYYY-MM-DD' o ''.
 * En web usa el date picker del navegador.
 */
export function DateField({
  label,
  value,
  onChange,
  optional,
  error,
  placeholder = 'Elegir fecha',
  paso,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean;
  error?: string;
  placeholder?: string;
  paso?: Paso;
}) {
  const c = useC();
  const styles = useEstilos();
  const [abierto, setAbierto] = useState(false);
  const fecha = value ? new Date(`${value}T00:00:00`) : new Date();

  const alElegir = (e: DateTimePickerEvent, d?: Date) => {
    setAbierto(false);
    if (e.type === 'set' && d) onChange(aISO(d));
  };

  return (
    <BloquePaso paso={paso} style={styles.field}>
      <Question paso={paso}>{label}</Question>
      {Platform.OS === 'web' ? (
        // DateTimePicker no tiene versión web: el campo de fecha del navegador.
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{
            borderRadius: radio.campo,
            border: `1px solid ${error ? c.danger : c.mutedDim}`,
            background: c.bg,
            color: c.text,
            padding: '13px 14px',
            fontSize: 16,
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <>
          <Pressable
            style={[styles.input, error ? styles.inputError : null]}
            onPress={() => setAbierto(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value ? fechaLegible(value) : placeholder}`}
          >
            <Text style={{ fontSize: 16, color: value ? c.text : c.mutedDim }}>
              {value ? fechaLegible(value) : placeholder}
            </Text>
          </Pressable>
          {abierto && (
            <DateTimePicker value={fecha} mode="date" display="default" onChange={alElegir} />
          )}
        </>
      )}
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
      {optional && value ? <LinkButton title="Quitar fecha" onPress={() => onChange('')} /> : null}
    </BloquePaso>
  );
}

/**
 * La fecha una vez (plantilla Formulario): Hoy por defecto, Ayer u Otra fecha
 * (calendario). Para registrar algo que ya pasó; lo futuro usa `DateField`.
 */
export function Cuando({
  label = '¿Cuándo?',
  value,
  onChange,
  paso,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  paso?: Paso;
}) {
  const styles = useEstilos();
  const hoy = aISO(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const ayer = aISO(d);
  const [otra, setOtra] = useState(value !== '' && value !== hoy && value !== ayer);
  const elegido = otra ? 'otra' : value === ayer ? 'ayer' : 'hoy';
  return (
    <BloquePaso paso={paso} style={styles.field}>
      <Question paso={paso}>{label}</Question>
      <View style={styles.chipsFila}>
        <Chip label="Hoy" activo={elegido === 'hoy'} onPress={() => { setOtra(false); onChange(hoy); }} />
        <Chip label="Ayer" activo={elegido === 'ayer'} onPress={() => { setOtra(false); onChange(ayer); }} />
        <Chip label="Otra fecha" activo={elegido === 'otra'} onPress={() => setOtra(true)} />
      </View>
      {otra && <DateField label="¿Qué día?" value={value} onChange={onChange} />}
    </BloquePaso>
  );
}

/**
 * Lo opcional, cerrado (plantilla Formulario): un enlace "+ …" que abre el
 * campo solo si se usa. Con `abierto` (ya trae valor, p. ej. de una
 * plantilla) se muestra abierto.
 */
export function Opcional({ titulo, abierto, children }: { titulo: string; abierto?: boolean; children: ReactNode }) {
  const [ver, setVer] = useState(false);
  return ver || abierto ? <>{children}</> : <LinkButton title={`+ ${titulo}`} onPress={() => setVer(true)} />;
}

/**
 * Campo de monto. `value` es el número canónico (solo dígitos, opcional `.`
 * decimal — ej. "8000000" o "8000000.5"); se muestra formateado es-CL
 * ("8.000.000" / "8.000,50"). `onChange` recibe siempre el canónico.
 */
/** Canónico ("8000000.5") → como se ve en es-CL ("8.000.000,5"). */
function montoVisible(value: string): string {
  if (value === '') return '';
  const [entero, dec] = value.split('.');
  return agruparMiles(entero || '0') + (value.includes('.') ? `,${dec ?? ''}` : '');
}

/** Lo que escribe el usuario ("8.000,50") → canónico ("8000.50"), máx. 2 decimales. */
function montoCanonico(t: string): string {
  let limpio = t.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const i = limpio.indexOf('.');
  if (i !== -1) {
    limpio = limpio.slice(0, i + 1) + limpio.slice(i + 1).replace(/\./g, '').slice(0, 2);
  }
  return limpio.replace(/^0+(?=\d)/, '');
}

export function MoneyField({
  label,
  value,
  onChange,
  moneda,
  placeholder = '0',
  error,
  paso,
}: {
  label: string;
  value: string;
  onChange: (canonico: string) => void;
  moneda?: string;
  placeholder?: string;
  error?: string;
  paso?: Paso;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <BloquePaso paso={paso} style={styles.field}>
      <Question paso={paso}>{moneda ? `${label} (${moneda})` : label}</Question>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        keyboardType="numeric"
        value={montoVisible(value)}
        onChangeText={(t) => onChange(montoCanonico(t))}
        placeholder={placeholder}
        placeholderTextColor={c.mutedDim}
      />
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
    </BloquePaso>
  );
}

/**
 * Monto protagonista de un formulario (patrón del prototipo): número grande
 * sobre una línea, con la moneda al lado. Mismo contrato que `MoneyField`
 * (`value` canónico). La línea usa `mutedDim` para que se vea editable (HZ-24).
 */
export function AmountInput({
  label = '¿Cuánto?',
  value,
  onChange,
  moneda,
  error,
  paso,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChange: (canonico: string) => void;
  moneda?: string;
  error?: string;
  paso?: Paso;
  autoFocus?: boolean;
}) {
  const c = useC();
  const styles = useEstilos();
  const [foco, setFoco] = useState(false);
  return (
    <BloquePaso paso={paso} style={styles.field}>
      <Question paso={paso}>{label}</Question>
      <View
        style={[
          styles.monto,
          foco && { borderBottomColor: c.text },
          error ? { borderBottomColor: c.danger } : null,
        ]}
      >
        <TextInput
          style={styles.montoInput}
          keyboardType="numeric"
          value={montoVisible(value)}
          onChangeText={(t) => onChange(montoCanonico(t))}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          placeholder="0"
          placeholderTextColor={c.mutedDim}
          autoFocus={autoFocus}
          accessibilityLabel={moneda ? `${label} en ${moneda}` : label}
        />
        {moneda ? <Text style={styles.montoMoneda}>{moneda}</Text> : null}
      </View>
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
    </BloquePaso>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const c = useC();
  const styles = useEstilos();
  const outline = variant === 'secondary' || variant === 'danger';
  const tinteBtn = variant === 'danger' ? c.danger : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? tinteBtn : c.primaryText} />
      ) : (
        <Text style={[styles.buttonText, outline && { color: tinteBtn }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  formatearOpcion = etiqueta,
  paso,
}: {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  formatearOpcion?: (v: T) => string;
  paso?: Paso;
}) {
  const styles = useEstilos();
  return (
    <BloquePaso paso={paso} style={styles.field}>
      {label ? <Question paso={paso}>{label}</Question> : null}
      <View style={styles.segmented}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === opt }}
            style={[styles.segment, value === opt && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, value === opt && styles.segmentTextActive]}>
              {formatearOpcion(opt)}
            </Text>
          </Pressable>
        ))}
      </View>
    </BloquePaso>
  );
}

export function SelectRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useEstilos();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.selectRow, selected && styles.selectRowActive]}
    >
      <Text style={[styles.selectRowText, selected && styles.selectRowTextActive]}>{label}</Text>
    </Pressable>
  );
}

export interface OpcionSelect {
  value: string;
  label: string;
  /** Encabezado bajo el que se muestra (p. ej. "Cuentas", "Cuentas de Zoily"). */
  grupo?: string;
  /** Segunda línea de la fila (p. ej. el saldo). */
  sub?: string;
  /** Se muestra atenuada y no se puede elegir; `sub` debería decir por qué. */
  deshabilitada?: boolean;
}

/**
 * HZ-3: toda lista de selección va en una hoja modal (`Select`), sin importar
 * cuántas opciones tenga (homogeneidad). La pantalla nunca crece por una lista.
 * Con más de `UMBRAL_BUSCADOR` opciones, la hoja muestra un buscador.
 */
export const UMBRAL_BUSCADOR = 6;

/** Minúsculas y sin tildes, para el buscador. */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Los elementos cuyo texto contiene `filtro` (sin tildes ni mayúsculas). */
export function filtrar<T>(items: T[], texto: (x: T) => string, filtro: string): T[] {
  const f = normalizar(filtro.trim());
  return f ? items.filter((x) => normalizar(texto(x)).includes(f)) : items;
}

/**
 * Buscador de una Lista o de la hoja de `Select`: solo aparece con más de
 * `UMBRAL_BUSCADOR` elementos (con menos estorba). Se filtra con `filtrar`.
 */
export function Buscador({
  total,
  value,
  onChange,
}: {
  total: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useC();
  const styles = useEstilos();
  if (total <= UMBRAL_BUSCADOR) return null;
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder="Buscar"
      placeholderTextColor={c.mutedDim}
      autoCorrect={false}
      accessibilityLabel="Buscar"
    />
  );
}

/** Agrupa conservando el orden de aparición; sin grupos (o con uno solo) no hay encabezados. */
function agrupar(options: OpcionSelect[]): { grupo: string | null; items: OpcionSelect[] }[] {
  const grupos: { grupo: string | null; items: OpcionSelect[] }[] = [];
  for (const o of options) {
    const g = o.grupo ?? null;
    const actual = grupos.find((x) => x.grupo === g);
    if (actual) actual.items.push(o);
    else grupos.push({ grupo: g, items: [o] });
  }
  return grupos.length > 1 ? grupos : [{ grupo: null, items: options }];
}

/**
 * Lista de opciones en una sola tarjeta (patrón del prototipo): filas
 * compactas con título y segunda línea, encabezados de grupo dentro de la
 * tarjeta y opciones deshabilitadas atenuadas. Se usa dentro de la hoja de
 * `Select` (HZ-3: la lista nunca va suelta en la pantalla).
 */
export function AccountList({
  options,
  elegida,
  onElegir,
  multiple,
}: {
  options: OpcionSelect[];
  elegida: (v: string) => boolean;
  onElegir: (v: string) => void;
  /** Varias a la vez: casilla en vez de círculo. */
  multiple?: boolean;
}) {
  const c = useC();
  const styles = useEstilos();
  const grupos = agrupar(options);
  return (
    <View style={styles.lista}>
      {grupos.map(({ grupo, items }, gi) => (
        <View key={grupo ?? '∅'}>
          {grupo ? <Text style={styles.listaGrupo}>{grupo}</Text> : null}
          {items.map((o, i) => {
            const on = elegida(o.value);
            const ultima = gi === grupos.length - 1 && i === items.length - 1;
            return (
              <Pressable
                key={o.value}
                disabled={o.deshabilitada}
                style={({ pressed }) => [
                  styles.listaFila,
                  ultima && { borderBottomWidth: 0 },
                  o.deshabilitada && { opacity: 0.45 },
                  pressed && { backgroundColor: c.panelAlt },
                ]}
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityLabel={o.sub ? `${o.label}. ${o.sub}` : o.label}
                accessibilityState={{ checked: on, disabled: !!o.deshabilitada }}
                onPress={() => onElegir(o.value)}
              >
                <View
                  style={[
                    multiple ? styles.casilla : styles.radio,
                    on && (multiple ? styles.casillaOn : styles.radioOn),
                  ]}
                >
                  {multiple && on ? <Ionicons name="checkmark" size={14} color={c.primaryText} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.listaTitulo} numberOfLines={1}>
                    {o.label}
                  </Text>
                  {o.sub ? (
                    <Text style={styles.listaSub} numberOfLines={1}>
                      {o.sub}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Contenido de la hoja modal: buscador (si hay más de UMBRAL_BUSCADOR) y `AccountList`. */
function ListaOpciones({
  options,
  elegida,
  onElegir,
  multiple,
  extra,
}: {
  options: OpcionSelect[];
  elegida: (v: string) => boolean;
  onElegir: (v: string) => void;
  multiple?: boolean;
  extra?: ReactNode;
}) {
  const styles = useEstilos();
  const [filtro, setFiltro] = useState('');
  const visibles = filtrar(options, (o) => o.label, filtro);

  return (
    <>
      <Buscador total={options.length} value={filtro} onChange={setFiltro} />
      <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
        {visibles.length > 0 ? (
          <AccountList options={visibles} elegida={elegida} onElegir={onElegir} multiple={multiple} />
        ) : (
          <Text style={styles.nota}>Sin resultados.</Text>
        )}
        {extra}
      </ScrollView>
    </>
  );
}

/**
 * Selector con hoja modal — para listas largas que como `Segmented` no caben.
 * Con `permiteOtro`, agrega la opción "Otro…" con un campo de texto libre.
 * Con `opcionNula`, agrega primero una opción "ninguna" (value '').
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegir…',
  permiteOtro,
  opcionNula,
  paso,
}: {
  label?: string;
  value: string;
  options: OpcionSelect[];
  onChange: (v: string) => void;
  placeholder?: string;
  permiteOtro?: boolean;
  opcionNula?: string;
  paso?: Paso;
}) {
  const c = useC();
  const styles = useEstilos();
  const [abierto, setAbierto] = useState(false);
  const [modoOtro, setModoOtro] = useState(false);
  const [otro, setOtro] = useState('');

  const todas = opcionNula ? [{ value: '', label: opcionNula }, ...options] : options;
  const conocida = todas.find((o) => o.value === value);
  // Un valor fuera de la lista solo se muestra si es texto libre ("Otro…").
  const libre = permiteOtro && !conocida && value ? value : '';
  const texto = conocida ? conocida.label : libre || placeholder;

  const cerrar = () => {
    setAbierto(false);
    setModoOtro(false);
    setOtro('');
  };

  return (
    <BloquePaso paso={paso} style={styles.field}>
      {label ? <Question paso={paso}>{label}</Question> : null}
      <Pressable
        style={styles.selectBox}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${texto}` : texto}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 16, color: conocida || libre ? c.text : c.mutedDim }}>{texto}</Text>
          {conocida?.sub ? <Text style={styles.listaSub}>{conocida.sub}</Text> : null}
        </View>
        <Ionicons name="chevron-down" size={16} color={c.muted} />
      </Pressable>

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={cerrar}>
        <Pressable style={styles.modalFondo} onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Pressable style={styles.modalHoja} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
            <View style={styles.agarre} />
            {label ? <Text style={styles.modalTitulo}>{label}</Text> : null}
            {modoOtro ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={styles.input}
                  value={otro}
                  onChangeText={setOtro}
                  autoFocus
                  placeholder="Escribe el valor"
                  placeholderTextColor={c.mutedDim}
                />
                <Button
                  title="Usar"
                  onPress={() => {
                    if (otro.trim()) {
                      onChange(otro.trim());
                      cerrar();
                    }
                  }}
                />
                <LinkButton title="Volver a la lista" onPress={() => setModoOtro(false)} />
              </View>
            ) : (
              <ListaOpciones
                options={todas}
                elegida={(v) => v === value}
                onElegir={(v) => {
                  onChange(v);
                  cerrar();
                }}
                extra={
                  permiteOtro ? (
                    <Pressable
                      style={styles.modalOpcion}
                      accessibilityRole="button"
                      accessibilityLabel="Otro valor"
                      onPress={() => setModoOtro(true)}
                    >
                      <Text style={[styles.modalOpcionTxt, { fontWeight: '600' }]}>Otro…</Text>
                    </Pressable>
                  ) : undefined
                }
              />
            )}
            <LinkButton title="Cancelar" onPress={cerrar} />
          </Pressable>
        </Pressable>
      </Modal>
    </BloquePaso>
  );
}

/** Elegir una opción (HZ-3): siempre `Select` en hoja modal. `null` = ninguna. */
export function Elegir({
  label,
  value,
  options,
  onChange,
  opcionNula,
  placeholder,
  paso,
}: {
  label: string;
  value: string | null;
  options: OpcionSelect[];
  onChange: (v: string | null) => void;
  opcionNula?: string;
  placeholder?: string;
  paso?: Paso;
}) {
  return (
    <Select
      label={label}
      paso={paso}
      value={value ?? ''}
      options={options}
      opcionNula={opcionNula}
      placeholder={placeholder}
      onChange={(v) => onChange(v === '' ? null : v)}
    />
  );
}

/** Elegir varias opciones (HZ-3): siempre en hoja modal, con botón "Listo". */
export function ElegirVarios({
  label,
  values,
  options,
  onChange,
  placeholder = 'Elegir…',
  paso,
}: {
  label: string;
  values: string[];
  options: OpcionSelect[];
  onChange: (vs: string[]) => void;
  placeholder?: string;
  paso?: Paso;
}) {
  const c = useC();
  const styles = useEstilos();
  const [abierto, setAbierto] = useState(false);
  const alternar = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const elegidas = options.filter((o) => values.includes(o.value));
  const texto =
    elegidas.length === 0
      ? placeholder
      : elegidas.length <= 2
        ? elegidas.map((o) => o.label).join(', ')
        : `${elegidas.length} elegidos`;

  return (
    <BloquePaso paso={paso} style={styles.field}>
      <Question paso={paso}>{label}</Question>
      <Pressable
        style={styles.selectBox}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${texto}`}
      >
        <Text style={{ flexShrink: 1, fontSize: 16, color: elegidas.length ? c.text : c.mutedDim }}>
          {texto}
        </Text>
        <Ionicons name="chevron-down" size={16} color={c.muted} />
      </Pressable>
      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable
          style={styles.modalFondo}
          onPress={() => setAbierto(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Pressable style={styles.modalHoja} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
            <View style={styles.agarre} />
            <Text style={styles.modalTitulo}>{label}</Text>
            <ListaOpciones options={options} elegida={(v) => values.includes(v)} onElegir={alternar} multiple />
            <Button title="Listo" onPress={() => setAbierto(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </BloquePaso>
  );
}

/** Cabecera de un formulario por pasos: "Paso N de M" + barra de avance. */
export function Pasos({ actual, total }: { actual: number; total: number }) {
  const styles = useEstilos();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.nota}>
        Paso {actual} de {total}
      </Text>
      <ProgressBar pct={(actual / total) * 100} />
    </View>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const styles = useEstilos();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  );
}

/** Paleta estable para categorías sin color propio (índice → hex). */
export const PALETA_CATEGORIA = [
  '#3b82f6', '#0891b2', '#16a34a', '#ca8a04', '#dc2626',
  '#9333ea', '#db2777', '#ea580c', '#64748b', '#0d9488', '#7c3aed',
];

export function colorCategoria(color: string | null, i: number): string {
  return color ?? PALETA_CATEGORIA[i % PALETA_CATEGORIA.length];
}

/** Barra 100 % apilada: reparte un total en segmentos de color (la "dona" plana). */
export function BarraDistribucion({
  segmentos,
}: {
  segmentos: { valor: number; color: string }[];
}) {
  const styles = useEstilos();
  const total = segmentos.reduce((s, x) => s + Math.max(0, x.valor), 0);
  if (total <= 0) return <View style={[styles.progressTrack, { height: 14 }]} />;
  return (
    <View style={styles.distTrack}>
      {segmentos.map((s, i) =>
        s.valor > 0 ? (
          <View
            key={i}
            style={{ width: `${(Math.max(0, s.valor) / total) * 100}%`, backgroundColor: s.color }}
          />
        ) : null,
      )}
    </View>
  );
}

/** Punto de color (leyenda de categoría). */
export function Punto({ color }: { color: string }) {
  const styles = useEstilos();
  return <View style={[styles.punto, { backgroundColor: color }]} />;
}

/** Etiqueta compacta. Con `onPress` funciona como toggle (relleno si `activo`). */
export function Chip({
  label,
  activo,
  color,
  onPress,
}: {
  label: string;
  activo?: boolean;
  color?: string | null;
  onPress?: () => void;
}) {
  const c = useC();
  const styles = useEstilos();
  const tinteChip = color ?? c.primary;
  const cuerpo = (
    <View
      style={[
        styles.chip,
        activo ? { backgroundColor: tinteChip, borderColor: tinteChip } : { borderColor: c.border },
      ]}
    >
      <Text style={[styles.chipText, activo && { color: color ? '#fff' : c.primaryText }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!activo }}
      accessibilityLabel={label}
    >
      {cuerpo}
    </Pressable>
  ) : (
    cuerpo
  );
}

/**
 * Monto con formato es-CL. Los negativos (deudas, saldos en contra) van en rojo
 * y, si `contable`, entre paréntesis en vez de con signo "−".
 */
export function MoneyText({
  monto,
  moneda,
  style,
  contable,
}: {
  monto: number;
  moneda: string;
  style?: object;
  contable?: boolean;
}) {
  const c = useC();
  const abs = Math.abs(monto).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const neg = monto < 0;
  const texto = neg ? (contable ? `(${abs} ${moneda})` : `−${abs} ${moneda}`) : `${abs} ${moneda}`;
  return <Text style={[{ color: neg ? c.danger : c.text }, style]}>{texto}</Text>;
}

export function Row({ left, right }: { left: string; right: ReactNode }) {
  const styles = useEstilos();
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLeft}>{left}</Text>
      {typeof right === 'string' ? <Text style={styles.dataRight}>{right}</Text> : right}
    </View>
  );
}

/**
 * Plantilla Ajustes: guarda al instante. Quien llama ya mostró el valor nuevo;
 * si el comando falla, `revertir` vuelve al anterior y se avisa.
 */
export function useGuardarAlInstante() {
  const toast = useToast();
  return async (fn: () => Promise<unknown>, revertir: () => void, aviso = 'Guardado') => {
    try {
      await fn();
      if (aviso) toast.mostrar(aviso);
      return true;
    } catch (e) {
      revertir();
      toast.mostrar(e instanceof Error && e.message ? e.message : 'No se pudo guardar', 'error');
      return false;
    }
  };
}

/** Fila de Ajustes con interruptor: para todo lo que es sí o no. */
export function Interruptor({
  titulo,
  sub,
  value,
  onChange,
}: {
  titulo: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={titulo}
      style={styles.interruptor}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.listItemTitle}>{titulo}</Text>
        {sub ? <Text style={styles.nota}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.primary, false: c.faint }}
        thumbColor={c.bg}
        ios_backgroundColor={c.faint}
      />
    </Pressable>
  );
}

/**
 * Texto de Ajustes que se guarda al salir del campo (decisión de R1). Si
 * queda vacío o igual, no se envía; si falla, vuelve al valor guardado y avisa.
 */
export function CampoAlSalir({
  label,
  value,
  onGuardar,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  label: string;
  value: string;
  onGuardar: (v: string) => Promise<unknown>;
}) {
  const [texto, setTexto] = useState(value);
  const guardar = useGuardarAlInstante();
  useEffect(() => setTexto(value), [value]);
  return (
    <Field
      label={label}
      value={texto}
      onChangeText={setTexto}
      onBlur={() => {
        const v = texto.trim();
        if (!v) return setTexto(value);
        if (v !== value) void guardar(() => onGuardar(v), () => setTexto(value));
      }}
      returnKeyType="done"
      {...props}
    />
  );
}

/** ▲▼ para cambiar el orden de un catálogo en su Lista (`TxRow accesorio`). Sin handler, la flecha se atenúa. */
export function Ordenar({ onSubir, onBajar }: { onSubir?: () => void; onBajar?: () => void }) {
  const c = useC();
  const styles = useEstilos();
  const flecha = (icono: NombreIcono, label: string, onPress?: () => void) => (
    <Pressable
      hitSlop={8}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
    >
      <Ionicons name={icono} size={18} color={onPress ? c.primary : c.border} />
    </Pressable>
  );
  return (
    <View style={styles.ordenar}>
      {flecha('chevron-up', 'Subir', onSubir)}
      {flecha('chevron-down', 'Bajar', onBajar)}
    </View>
  );
}

/** Datos en pares de un Detalle: una sola tarjeta, sin campos editables. */
export function Datos({ children }: { children: ReactNode }) {
  return <ListCard>{children}</ListCard>;
}

/** Un par etiqueta (izquierda) · valor (derecha) dentro de `Datos`. */
export function Dato({ etiqueta: nombre, valor }: { etiqueta: string; valor: ReactNode }) {
  const styles = useEstilos();
  return (
    <View style={styles.dato}>
      <Text style={styles.dataLeft}>{nombre}</Text>
      {typeof valor === 'string' ? <Text style={styles.dataRight}>{valor}</Text> : valor}
    </View>
  );
}

/**
 * Acción destructiva de una pantalla (Eliminar, Cerrar sesión): texto rojo,
 * al final de todo el contenido. La confirmación la pide quien la usa.
 */
export function AccionDestructiva({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useEstilos();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.destructiva}>
      <Text style={styles.destructivaTxt}>{title}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const styles = useEstilos();
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useEstilos();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

/**
 * Fila de menú: título + subtítulo opcional + chevron. Para las pantallas "hub".
 * Para varias seguidas, preferir `<MenuList>` (las agrupa en una sola tarjeta).
 */
export function MenuLink({
  title,
  subtitle,
  badge,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  badge?: number;
  icon?: NombreIcono;
  onPress: () => void;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.menuLink, pressed && styles.buttonPressed]}
    >
      {icon ? (
        <View style={styles.menuIcono}>
          <Ionicons name={icon} size={18} color={c.text} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLinkTitle}>{title}</Text>
        {subtitle ? <Text style={styles.menuLinkSub}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.menuChevron}>›</Text>
    </Pressable>
  );
}

/** Lista de accesos agrupados en una sola tarjeta (patrón "list-menu"). */
export function MenuList({
  items,
}: {
  items: {
    key?: string;
    title: string;
    subtitle?: string;
    icon?: NombreIcono;
    badge?: number;
    onPress: () => void;
  }[];
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.menuList}>
      {items.map((it, i) => (
        <Pressable
          key={it.key ?? it.title}
          onPress={it.onPress}
          accessibilityRole="button"
          accessibilityLabel={it.subtitle ? `${it.title}. ${it.subtitle}` : it.title}
          style={({ pressed }) => [
            styles.menuListFila,
            i === items.length - 1 && { borderBottomWidth: 0 },
            pressed && { backgroundColor: c.faint },
          ]}
        >
          {it.icon ? (
            <Ionicons name={it.icon} size={16} color={c.muted} style={{ width: 20, textAlign: 'center' }} />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.menuListTxt}>{it.title}</Text>
            {it.subtitle ? <Text style={styles.menuLinkSub}>{it.subtitle}</Text> : null}
          </View>
          {it.badge ? (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{it.badge}</Text>
            </View>
          ) : null}
          <Text style={styles.menuListChev}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Encabezado de grupo dentro de una pantalla hub. `right` = acción a la derecha. */
export function GroupLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const styles = useEstilos();
  return (
    <View style={styles.groupLabelRow}>
      <Text style={styles.groupLabel}>{children}</Text>
      {right}
    </View>
  );
}

/**
 * Caja de ayuda contextual: un ícono de info + una explicación breve, sobre
 * fondo apenas tintado. Para conceptos que la gente no maneja. Discreta.
 */
export function Ayuda({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.ayuda}>
      <Ionicons name="information-circle-outline" size={18} color={c.muted} />
      <Text style={styles.ayudaTexto}>{children}</Text>
    </View>
  );
}

/** Placeholder mientras carga una lista — mejor que un spinner suelto. */
export function Skeleton({ filas = 3 }: { filas?: number }) {
  const styles = useEstilos();
  const pulso = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulso]);

  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: filas }).map((_, i) => (
        <Animated.View key={i} style={[styles.skelCard, { opacity: pulso }]}>
          <View style={[styles.skelBar, { width: '50%' }]} />
          <View style={[styles.skelBar, { width: '78%' }]} />
        </Animated.View>
      ))}
    </View>
  );
}

/** Estado vacío con ícono, texto y (opcional) una acción para empezar. */
export function EmptyState({
  icon,
  titulo,
  descripcion,
  accion,
  onAccion,
}: {
  icon?: NombreIcono;
  titulo: string;
  descripcion?: string;
  accion?: string;
  onAccion?: () => void;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.empty}>
      {icon ? <Ionicons name={icon} size={36} color={c.mutedDim} /> : null}
      <Text style={styles.emptyTitulo}>{titulo}</Text>
      {descripcion ? <Text style={styles.emptyDesc}>{descripcion}</Text> : null}
      {accion && onAccion ? (
        <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
          <Button title={accion} onPress={onAccion} />
        </View>
      ) : null}
    </View>
  );
}

const crearEstilos = (c: Paleta) => {
  const t = tipoDe(c);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.fondo },
    screenContent: { paddingHorizontal: 16, gap: 14, flexGrow: 1 },
    fabWrap: { position: 'absolute', right: 18 },
    pie: {
      paddingTop: 12,
      paddingHorizontal: 16,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.fondo,
    },
    fab: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 14,
    },
    fabActionIc: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabActionTxt: { fontSize: 16, color: c.text, fontWeight: '600' },
    fabActionSub: { fontSize: 13, color: c.muted, marginTop: 2 },
    agarre: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.panelAlt,
      alignSelf: 'center',
      marginTop: -8,
      marginBottom: 4,
    },
    seccion: { gap: 8, marginTop: 8 },
    seccionCabeza: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rotulo: { ...tipografia.rotulo, color: c.muted },
    seccionAccion: { fontSize: 13, fontWeight: '600', color: c.muted },
    listCard: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.tarjeta,
      paddingHorizontal: 14,
      overflow: 'hidden',
    },
    lista: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.tarjeta,
      overflow: 'hidden',
    },
    listaGrupo: { ...tipografia.rotulo, color: c.muted, paddingTop: 10, paddingBottom: 4, paddingHorizontal: 14 },
    listaFila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    listaTitulo: { ...tipografia.fila, color: c.text },
    listaSub: { ...tipografia.filaSub, color: c.muted, marginTop: 2 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.mutedDim },
    radioOn: { borderWidth: 6, borderColor: c.text },
    casilla: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.mutedDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    casillaOn: { backgroundColor: c.text, borderColor: c.text },
    monto: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      borderBottomWidth: 2,
      borderBottomColor: c.mutedDim, // HZ-24: contraste de lo editable
    },
    montoInput: { ...tipografia.monto, flex: 1, minWidth: 0, color: c.text, paddingVertical: 6 },
    montoMoneda: { fontSize: 18, fontWeight: '600', color: c.muted },
    pillToggle: {
      flexDirection: 'row',
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      padding: 2,
    },
    pillToggleOpt: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
    pillToggleOptActive: { backgroundColor: c.primary },
    pillToggleTxt: { fontSize: 12, fontWeight: '600', color: c.muted },
    pillToggleTxtActive: { color: c.primaryText },

    // hub / hero
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    topRowSide: { flexShrink: 1 },
    topActions: { flexDirection: 'row', gap: 8 },
    pillDate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    pillDateTxt: { fontSize: 12, color: c.text, fontWeight: '500' },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },

    hero: { paddingHorizontal: 2, gap: 6 },
    heroLbl: { ...tipografia.rotulo, color: c.muted },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    heroVal: { ...tipografia.hero, color: c.text },
    heroChg: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden' },
    heroSubs: { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
    heroSub: { fontSize: 13, color: c.muted },
    heroSubB: { color: c.text, fontWeight: '700' },
    heroChart: { marginTop: 10 },

    quickRow: { flexDirection: 'row', gap: 10 },
    quickItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8 },
    quickIc: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickTxt: { fontSize: 10, color: c.muted, fontWeight: '500' },

    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    txLogo: {
      width: 36,
      height: 36,
      borderRadius: radio.icono,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txLogoTxt: { fontSize: 15, fontWeight: '800' },
    txMain: { flex: 1, minWidth: 0 },
    txTitle: { ...tipografia.fila, color: c.text },
    txSub: { ...tipografia.filaSub, color: c.muted, marginTop: 2 },
    txTag: { color: '#8b5cf6', fontWeight: '700', letterSpacing: 0.3 },
    txAmt: { fontSize: 15, fontWeight: '700', color: c.text },
    ordenar: { flexDirection: 'row', gap: 14, marginLeft: 8 },
    chipsFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },

    goalCard: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.tarjeta,
      padding: 14,
    },
    goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    goalName: { ...tipografia.fila, color: c.text, flex: 1 },
    goalHint: { fontSize: 13, color: c.muted },
    goalBar: { height: 4, backgroundColor: c.panelAlt, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
    goalBarFill: { height: 4 },
    goalFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 },
    goalFootTxt: { fontSize: 13, color: c.muted, flexShrink: 1 },
    goalFootMonto: { color: c.text, fontWeight: '700' },
    goalBtn: {
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.panelAlt,
      justifyContent: 'center',
    },
    goalBtnTxt: { fontSize: 14, fontWeight: '600', color: c.text },

    miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    miniPanel: {
      flexGrow: 1,
      flexBasis: '47%',
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 13,
      position: 'relative',
    },
    miniLbl: {
      fontSize: 10,
      color: c.mutedDim,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    miniVal: { fontSize: 18, fontWeight: '700', color: c.text, marginTop: 4 },
    miniSub: { fontSize: 11, color: c.mutedDim, marginTop: 2 },
    miniChev: { position: 'absolute', top: 12, right: 10 },

    card: {
      backgroundColor: c.bg,
      borderRadius: radio.tarjeta,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
    cardPressed: { opacity: 0.7 },
    cardFranja: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
    title: t.titulo,
    sectionTitle: t.seccion,
    nota: t.nota,
    statValue: { fontSize: 20, fontWeight: '800', color: c.text, letterSpacing: -0.3 },
    listItemTitle: t.dato,
    migaja: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: -8 },
    migajaTexto: { fontSize: 13, color: c.muted, fontWeight: '600' },
    paragraph: { fontSize: 15, color: c.muted, lineHeight: 22 },
    field: { gap: 6 },
    label: { ...tipografia.pregunta, color: c.text },
    labelOpcional: { fontWeight: '400', color: c.muted },
    etiquetaPaso: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    numeroPaso: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.mutedDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numeroPasoTexto: { fontSize: 11, fontWeight: '600', color: c.muted },
    numeroPasoActual: { backgroundColor: c.primary, borderColor: c.primary },
    numeroPasoTextoActual: { color: c.primaryText },
    // La barra va en el margen para que el contenido no se mueva al avanzar.
    bloquePaso: { borderLeftWidth: 2, borderLeftColor: 'transparent', paddingLeft: 8, marginLeft: -10 },
    bloquePasoActual: { borderLeftColor: c.primary },
    bloquePasoBloqueado: { opacity: 0.4, pointerEvents: 'none' },
    input: {
      borderWidth: 1,
      borderColor: c.mutedDim, // HZ-24: contraste de lo editable
      borderRadius: radio.campo,
      backgroundColor: c.bg,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      color: c.text,
    },
    inputError: { borderColor: c.danger },
    errorInline: { color: c.danger, fontSize: 12 },
    button: {
      backgroundColor: c.primary,
      borderRadius: radio.boton,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.primary },
    buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger },
    buttonDisabled: { opacity: 0.35 },
    buttonPressed: { opacity: 0.85 },
    buttonText: { ...tipografia.boton, color: c.primaryText },
    error: { color: c.danger, fontSize: 14 },
    link: { color: c.text, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
    segmented: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    segment: {
      borderWidth: 1,
      borderColor: c.mutedDim, // HZ-24: contraste de lo editable
      borderRadius: radio.pastilla,
      backgroundColor: c.bg,
      paddingVertical: 9,
      paddingHorizontal: 14,
      minHeight: 40,
      justifyContent: 'center',
    },
    segmentActive: { backgroundColor: c.primary, borderColor: c.primary },
    segmentText: { fontSize: 14, color: c.text, fontWeight: '500' },
    segmentTextActive: { color: c.primaryText },
    selectRow: { borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 },
    selectRowActive: { borderColor: c.primary, backgroundColor: c.faint },
    selectBox: {
      borderWidth: 1,
      borderColor: c.mutedDim, // HZ-24: contraste de lo editable
      borderRadius: radio.campo,
      backgroundColor: c.bg,
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalHoja: {
      backgroundColor: c.fondo,
      borderTopLeftRadius: radio.hoja,
      borderTopRightRadius: radio.hoja,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 32,
      gap: 10,
      maxHeight: '85%',
    },
    modalTitulo: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 2 },
    modalOpcion: { paddingVertical: 14, paddingHorizontal: 2 },
    modalOpcionTxt: { fontSize: 16, color: c.text },
    selectRowText: { fontSize: 15, color: c.text },
    selectRowTextActive: { color: c.text, fontWeight: '600' },
    dato: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    destructiva: { alignSelf: 'stretch', paddingTop: 22, paddingBottom: 6 },
    destructivaTxt: { color: c.danger, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
    dataLeft: { fontSize: 14, color: c.muted },
    dataRight: { fontSize: 14, color: c.text, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: c.panelAlt, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: c.text },
    distTrack: {
      flexDirection: 'row',
      height: 10,
      borderRadius: 5,
      backgroundColor: c.panelAlt,
      overflow: 'hidden',
    },
    punto: { width: 10, height: 10, borderRadius: 5 },
    chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
    chipText: { fontSize: 13, color: c.text, fontWeight: '600' },
    menuLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: c.bg,
    },
    menuLinkTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    menuLinkSub: { ...tipografia.filaSub, color: c.muted, marginTop: 2 },
    menuIcono: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.faint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuChevron: { fontSize: 22, color: c.mutedDim },
    menuList: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.tarjeta,
      overflow: 'hidden',
    },
    menuListFila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    menuListTxt: { ...tipografia.fila, color: c.text },
    menuListChev: { fontSize: 15, color: c.mutedDim },
    menuBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    menuBadgeText: { color: c.primaryText, fontSize: 12, fontWeight: '700' },
    groupLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    groupLabel: { ...tipografia.rotulo, color: c.muted },
    ayuda: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: c.info,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
    },
    ayudaTexto: { flex: 1, fontSize: 13, color: c.muted, lineHeight: 19 },
    skelCard: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 16,
      gap: 10,
    },
    skelBar: { height: 12, borderRadius: 6, backgroundColor: c.panelAlt },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 8 },
    emptyTitulo: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptyDesc: { fontSize: 13, color: c.muted, textAlign: 'center', lineHeight: 19 },
  });
};
