import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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

function agruparMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const colors = {
  bg: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#d1d5db',
  primary: '#1d4ed8',
  primaryText: '#ffffff',
  danger: '#b91c1c',
  faint: '#f3f4f6',
};

/**
 * Contenedor scrollable de cada pantalla. Si se pasa `onRefresh`, habilita
 * "deslizar para actualizar" (y gestiona su propio estado de spinner).
 */
export function Screen({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} tintColor={colors.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        {...props}
      />
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
          <Pressable style={styles.input} onPress={() => setAbierto(true)}>
            <Text style={{ fontSize: 16, color: value ? colors.text : colors.muted }}>
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
 * Campo de monto: muestra el número con separador de miles mientras se escribe,
 * y entrega el valor numérico "limpio" (string sin puntos, con `.` decimal).
 */
export function MoneyField({
  label,
  value,
  onChange,
  moneda,
  placeholder = '0',
}: {
  label: string;
  value: string;
  onChange: (limpio: string) => void;
  moneda?: string;
  placeholder?: string;
}) {
  const [entero, dec] = value.split('.');
  const display =
    value === '' ? '' : agruparMiles(entero || '0') + (value.includes('.') ? `,${dec ?? ''}` : '');

  const alEscribir = (t: string) => {
    // deja solo dígitos y una coma/punto decimal
    let limpio = t.replace(/[^\d.,]/g, '').replace(/,/g, '.');
    const partes = limpio.split('.');
    limpio = partes[0] + (partes.length > 1 ? '.' + partes.slice(1).join('').slice(0, 2) : '');
    onChange(limpio);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{moneda ? `${label} (${moneda})` : label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={display}
        onChangeText={alEscribir}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
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
  const outline = variant === 'secondary' || variant === 'danger';
  const tinte = variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? tinte : colors.primaryText} />
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
}: {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segmented}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.segment, value === opt && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, value === opt && styles.segmentTextActive]}>
              {opt}
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
  return (
    <Pressable onPress={onPress} style={[styles.selectRow, selected && styles.selectRowActive]}>
      <Text style={[styles.selectRowText, selected && styles.selectRowTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  );
}

export function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLeft}>{left}</Text>
      <Text style={styles.dataRight}>{right}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { paddingHorizontal: 24, gap: 16, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  paragraph: { fontSize: 15, color: colors.muted, lineHeight: 22 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonSecondary: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  buttonTextSecondary: { color: colors.primary },
  error: { color: colors.danger, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  segmented: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segment: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  segmentTextActive: { color: colors.primaryText },
  selectRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  selectRowActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  selectRowText: { fontSize: 15, color: colors.text },
  selectRowTextActive: { color: colors.primary, fontWeight: '600' },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dataLeft: { fontSize: 14, color: colors.muted },
  dataRight: { fontSize: 14, color: colors.text, fontWeight: '600' },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.faint,
    overflow: 'hidden',
  },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
