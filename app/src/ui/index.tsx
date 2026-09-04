import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { etiqueta } from '../labels';
import { CLARO, useC, type Paleta } from './tema';

export type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];

export { etiqueta, humanizar } from '../labels';
export { TemaProvider, useC, useTema, type Paleta, type ModoTema } from './tema';

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

/** 'YYYY-MM-DD' → "15 mar 2026". Devuelve el string tal cual si no parsea. */
export function fechaLegible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
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

/**
 * @deprecated Paleta clara estática. En componentes usa `useC()` para que
 * respete el modo oscuro; esto queda solo para código aún sin migrar.
 */
export const colors = CLARO;

/** Sombra sutil compartida por las tarjetas (iOS + Android). */
export const sombra = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

/** Escala de espaciado (múltiplos de 4). Usar para `gap` / `margin` / `padding`. */
export const escala = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Contenedor tipo tarjeta (panel blanco con borde). Fuente única del "look" de
 * tarjeta — antes cada pantalla lo redefinía. El `gap` interno lo pone `Panel`
 * o cada pantalla.
 */
export const panelDe = (c: Paleta) =>
  ({
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
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
    titulo: { fontSize: 24, fontWeight: '700', color: c.text },
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
}: {
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
  /** Botón flotante fijo (no scrollea) abajo a la derecha. */
  fab?: ReactNode;
}) {
  const c = useC();
  const styles = useEstilos();
  const insets = useSafeAreaInsets();
  // Si hay header nativo de navegación (altura > 0), él cubre el área segura
  // superior. Ojo: el native-stack expone el contexto con valor 0 aun cuando
  // el header está oculto (pantallas de tab) — por eso el > 0.
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
            paddingTop: conHeader ? 16 : 24 + insets.top,
            paddingBottom: 24 + (conHeader ? insets.bottom : 0) + (fab ? 72 : 0),
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
      {fab ? (
        <View
          style={[
            styles.fabWrap,
            // en pantallas de tab (sin header) hay que despejar la barra inferior
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
      <Ionicons name={icon} size={26} color={c.primaryText} />
    </Pressable>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useC();
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
 * Tarjeta blanca con sombra sutil. Si se pasa `onPress`, es tocable y muestra
 * un chevron "ver más" a la derecha. `franja` pinta una barra de color a la
 * izquierda (p. ej. para diferenciar agrupaciones).
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
 * Contenedor de contenido en tarjeta (vertical, no tocable). Reemplaza el
 * `<View style={styles.card}>` que cada pantalla redefinía. `gap` controla la
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
  const styles = useEstilos();
  return <View style={[panelDe(c), { gap }, style]}>{children}</View>;
}

/** Encabezado de una tarjeta / sección de contenido. */
export function SectionTitle({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** Texto secundario corto (13px, gris). Para pies de tarjeta y aclaraciones. */
export function Nota({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return <Text style={styles.nota}>{children}</Text>;
}

/**
 * Fila de una lista de contenido: título + subtítulo opcional + valor a la
 * derecha + chevron si es tocable. Unifica los `Pressable`/`View` sueltos que
 * cada pantalla armaba para sus listas.
 */
export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  tachado,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  tachado?: boolean;
}) {
  const c = useC();
  const styles = useEstilos();
  const cuerpo = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={[styles.listItemTitle, tachado && styles.listItemTachado]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.nota}>{subtitle}</Text> : null}
      </View>
      {typeof right === 'string' ? <Text style={styles.dataRight}>{right}</Text> : right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={c.muted} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.listItem, pressed && styles.cardPressed]}
      >
        {cuerpo}
      </Pressable>
    );
  }
  return <View style={styles.listItem}>{cuerpo}</View>;
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
  const c = useC();
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
  const c = useC();
  const styles = useEstilos();
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        {...props}
      />
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
    </View>
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
  placeholder = 'Elegir fecha',
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean;
  placeholder?: string;
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
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web' ? (
        <DateTimePicker value={fecha} mode="date" display="default" onChange={alElegir} />
      ) : (
        <>
          <Pressable
            style={styles.input}
            onPress={() => setAbierto(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value ? fechaLegible(value) : placeholder}`}
          >
            <Text style={{ fontSize: 16, color: value ? c.text : c.muted }}>
              {value ? fechaLegible(value) : placeholder}
            </Text>
          </Pressable>
          {abierto && (
            <DateTimePicker value={fecha} mode="date" display="default" onChange={alElegir} />
          )}
        </>
      )}
      {optional && value ? <LinkButton title="Quitar fecha" onPress={() => onChange('')} /> : null}
    </View>
  );
}

/**
 * Campo de monto. `value` es el número canónico (solo dígitos, opcional `.`
 * decimal — ej. "8000000" o "8000000.5"); se muestra formateado es-CL
 * ("8.000.000" / "8.000,50"). `onChange` recibe siempre el canónico.
 */
export function MoneyField({
  label,
  value,
  onChange,
  moneda,
  placeholder = '0',
  error,
}: {
  label: string;
  value: string;
  onChange: (canonico: string) => void;
  moneda?: string;
  placeholder?: string;
  error?: string;
}) {
  const c = useC();
  const styles = useEstilos();
  const [entero, dec] = value.split('.');
  const display =
    value === ''
      ? ''
      : agruparMiles(entero || '0') + (value.includes('.') ? `,${dec ?? ''}` : '');

  const alEscribir = (t: string) => {
    // El texto viene con formato de display: '.' = miles, ',' = decimal.
    let limpio = t.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const i = limpio.indexOf('.');
    if (i !== -1) {
      // una sola coma decimal, máx. 2 dígitos
      limpio = limpio.slice(0, i + 1) + limpio.slice(i + 1).replace(/\./g, '').slice(0, 2);
    }
    limpio = limpio.replace(/^0+(?=\d)/, ''); // sin ceros a la izquierda
    onChange(limpio);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{moneda ? `${label} (${moneda})` : label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        keyboardType="numeric"
        value={display}
        onChangeText={alEscribir}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
      />
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}
    </View>
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
  const tinte = variant === 'danger' ? c.danger : c.primary;
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
        <ActivityIndicator color={outline ? tinte : c.primaryText} />
      ) : (
        <Text style={[styles.buttonText, outline && { color: tinte }]}>{title}</Text>
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
}: {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  /** Cómo se muestra cada opción (por defecto, la etiqueta legible del enum). */
  formatearOpcion?: (v: T) => string;
}) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
    </View>
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
  const c = useC();
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
}

/**
 * Selector con hoja modal — para listas largas que como `Segmented` no caben.
 * Con `permiteOtro`, agrega la opción "Otro…" con un campo de texto libre.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegir…',
  permiteOtro,
}: {
  label?: string;
  value: string;
  options: OpcionSelect[];
  onChange: (v: string) => void;
  placeholder?: string;
  permiteOtro?: boolean;
}) {
  const c = useC();
  const styles = useEstilos();
  const [abierto, setAbierto] = useState(false);
  const [modoOtro, setModoOtro] = useState(false);
  const [otro, setOtro] = useState('');

  const conocida = options.find((o) => o.value === value);
  const texto = conocida ? conocida.label : value ? value : placeholder;

  const cerrar = () => {
    setAbierto(false);
    setModoOtro(false);
    setOtro('');
  };

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={styles.selectBox}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${texto}` : texto}
      >
        <Text style={{ fontSize: 16, color: conocida || value ? c.text : c.muted }}>
          {texto}
        </Text>
        <Text style={styles.selectCaret}>▾</Text>
      </Pressable>

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={cerrar}>
        <Pressable style={styles.modalFondo} onPress={cerrar}>
          <Pressable style={styles.modalHoja} onPress={(e) => e.stopPropagation()}>
            {label ? <Text style={styles.modalTitulo}>{label}</Text> : null}
            {modoOtro ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={styles.input}
                  value={otro}
                  onChangeText={setOtro}
                  autoFocus
                  placeholder="Escribe el valor"
                  placeholderTextColor={c.muted}
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
              <ScrollView style={{ maxHeight: 360 }}>
                {options.map((o) => (
                  <Pressable
                    key={o.value}
                    style={styles.modalOpcion}
                    onPress={() => {
                      onChange(o.value);
                      cerrar();
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOpcionTxt,
                        o.value === value && { color: c.primary, fontWeight: '700' },
                      ]}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
                {permiteOtro && (
                  <Pressable style={styles.modalOpcion} onPress={() => setModoOtro(true)}>
                    <Text style={[styles.modalOpcionTxt, { color: c.primary }]}>Otro…</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
            <LinkButton title="Cancelar" onPress={cerrar} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Cabecera de un formulario por pasos: "Paso N de M" + barra de avance. */
export function Pasos({ actual, total }: { actual: number; total: number }) {
  const c = useC();
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
  const c = useC();
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
  '#1d4ed8', '#0891b2', '#16a34a', '#ca8a04', '#dc2626',
  '#9333ea', '#db2777', '#ea580c', '#4b5563', '#0d9488', '#7c3aed',
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
  const c = useC();
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
  const c = useC();
  const styles = useEstilos();
  return <View style={[styles.punto, { backgroundColor: color }]} />;
}

/** Etiqueta compacta. Con `onPress` funciona como toggle (borde relleno si `activo`). */
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
  const tinte = color ?? c.primary;
  const cuerpo = (
    <View
      style={[
        styles.chip,
        activo ? { backgroundColor: tinte, borderColor: tinte } : { borderColor: c.border },
      ]}
    >
      <Text style={[styles.chipText, activo && { color: c.primaryText }]}>{label}</Text>
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
  const styles = useEstilos();
  const abs = Math.abs(monto).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const neg = monto < 0;
  const texto = neg ? (contable ? `(${abs} ${moneda})` : `−${abs} ${moneda}`) : `${abs} ${moneda}`;
  return <Text style={[{ color: neg ? c.danger : c.text }, style]}>{texto}</Text>;
}

export function Row({ left, right }: { left: string; right: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLeft}>{left}</Text>
      {typeof right === 'string' ? <Text style={styles.dataRight}>{right}</Text> : right}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

/** Fila de menú: título + subtítulo opcional + chevron. Para las pantallas "hub". */
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
          <Ionicons name={icon} size={20} color={c.primary} />
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

/** Encabezado de grupo dentro de una pantalla hub. */
export function GroupLabel({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return <Text style={styles.groupLabel}>{children}</Text>;
}

/**
 * Caja de ayuda contextual: un ícono de info + una explicación breve, sobre
 * fondo azul muy tenue. Para conceptos que la gente no maneja (objetivos,
 * asignaciones, reservas…). Discreta, no una tarjeta.
 */
export function Ayuda({ children }: { children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={styles.ayuda}>
      <Ionicons name="information-circle-outline" size={18} color={c.primary} />
      <Text style={styles.ayudaTexto}>{children}</Text>
    </View>
  );
}

/** Placeholder mientras carga una lista — mejor que un spinner suelto. */
export function Skeleton({ filas = 3 }: { filas?: number }) {
  const c = useC();
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
      {icon ? <Ionicons name={icon} size={40} color={c.muted} /> : null}
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
    fabWrap: { position: 'absolute', right: 20 },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...sombra,
      elevation: 6,
    },
    card: {
      backgroundColor: c.bg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      ...sombra,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
    cardPressed: { opacity: 0.7 },
    cardFranja: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    title: t.titulo,
    sectionTitle: t.seccion,
    nota: t.nota,
    statValue: { fontSize: 20, fontWeight: '800', color: c.text },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: c.faint,
      paddingVertical: 10,
    },
    listItemTitle: t.dato,
    listItemTachado: { textDecorationLine: 'line-through', color: c.muted },
    migaja: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: -8 },
    migajaTexto: { fontSize: 13, color: c.muted, fontWeight: '600' },
    paragraph: { fontSize: 15, color: c.muted, lineHeight: 22 },
    field: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
    },
    inputError: { borderColor: c.danger },
    errorInline: { color: c.danger, fontSize: 12 },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    buttonSecondary: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.primary,
    },
    buttonDanger: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.danger,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonPressed: { opacity: 0.85 },
    buttonText: { color: c.primaryText, fontSize: 16, fontWeight: '600' },
    buttonTextSecondary: { color: c.primary },
    error: { color: c.danger, fontSize: 14 },
    link: { color: c.primary, fontSize: 14, fontWeight: '600' },
    segmented: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    segment: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      minHeight: 44,
      justifyContent: 'center',
    },
    segmentActive: { backgroundColor: c.primary, borderColor: c.primary },
    segmentText: { fontSize: 13, color: c.text, fontWeight: '600' },
    segmentTextActive: { color: c.primaryText },
    selectRow: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
    },
    selectRowActive: { borderColor: c.primary, backgroundColor: c.info },
    selectBox: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectCaret: { fontSize: 14, color: c.muted },
    modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalHoja: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: 32,
      gap: 8,
    },
    modalTitulo: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
    modalOpcion: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.faint },
    modalOpcionTxt: { fontSize: 16, color: c.text },
    selectRowText: { fontSize: 15, color: c.text },
    selectRowTextActive: { color: c.primary, fontWeight: '600' },
    dataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    dataLeft: { fontSize: 14, color: c.muted },
    dataRight: { fontSize: 14, color: c.text, fontWeight: '600' },
    progressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: c.faint,
      overflow: 'hidden',
    },
    progressFill: { height: 10, borderRadius: 5, backgroundColor: c.primary },
    distTrack: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 7,
      backgroundColor: c.faint,
      overflow: 'hidden',
    },
    punto: { width: 10, height: 10, borderRadius: 5 },
    chip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: 12,
    },
    chipText: { fontSize: 13, color: c.text, fontWeight: '600' },
    menuLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    menuLinkTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    menuLinkSub: { fontSize: 12, color: c.muted, marginTop: 2 },
    menuIcono: {
      width: 34,
      height: 34,
      borderRadius: 8,
      backgroundColor: c.faint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuChevron: { fontSize: 22, color: c.muted },
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
    groupLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.muted,
      marginTop: 8,
      textTransform: 'uppercase',
    },
    ayuda: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: c.info,
      borderRadius: 10,
      padding: 12,
    },
    ayudaTexto: { flex: 1, fontSize: 13, color: c.text, lineHeight: 19 },
    skelCard: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 16,
      gap: 10,
    },
    skelBar: { height: 12, borderRadius: 6, backgroundColor: c.faint },
    empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 8 },
    emptyTitulo: { fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' },
    emptyDesc: { fontSize: 13, color: c.muted, textAlign: 'center', lineHeight: 19 },
  });
};
