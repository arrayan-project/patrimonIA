import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { tinte, useC, type Paleta } from './index';

/**
 * G35, tanda 6 (Acceso y primer uso): piezas de Entrar, Crear cuenta y
 * Recuperar contraseña. La cabecera de marca reemplaza al título suelto, la
 * banda dice a dónde llegó el código y el pie lleva a la otra pantalla.
 */

/** Cabecera: el árbol de la marca (crecimiento familiar) en un círculo, la marca y el título. */
export function CabeceraAcceso({ titulo }: { titulo: string }) {
  const styles = useEstilos();
  return (
    <View style={styles.cabecera}>
      <View style={styles.circulo}>
        <Text style={styles.circuloEmoji}>🌳</Text>
      </View>
      <Text style={styles.marca}>PatrimonIA</Text>
      <Text style={styles.frase}>Tu plata y la de tu hogar, en orden</Text>
      <Text style={styles.titulo} accessibilityRole="header">
        {titulo}
      </Text>
    </View>
  );
}

/** Banda suave del color de acento con un emoji (p. ej. "📬 Te mandamos un código…"). */
export function BandaAcceso({ emoji, children }: { emoji: string; children: ReactNode }) {
  const c = useC();
  const styles = useEstilos();
  return (
    <View style={[styles.banda, { backgroundColor: tinte(c.primary, 0.12), borderColor: tinte(c.primary, 0.28) }]}>
      <Text style={styles.bandaEmoji}>{emoji}</Text>
      <Text style={styles.bandaTxt}>{children}</Text>
    </View>
  );
}

/** Enlace sin subrayar, con zona de toque de 44 px. */
export function EnlaceAcceso({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useEstilos();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.enlace, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.enlaceTxt}>{title}</Text>
    </Pressable>
  );
}

/** Pie: "¿Primera vez?" + la pastilla que lleva a la otra pantalla. */
export function PieAcceso({
  pregunta,
  accion,
  onPress,
}: {
  pregunta: string;
  accion: string;
  onPress: () => void;
}) {
  const styles = useEstilos();
  return (
    <View style={styles.pie}>
      <Text style={styles.piePregunta}>{pregunta}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.pieBoton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.pieBotonTxt}>{accion}</Text>
      </Pressable>
    </View>
  );
}

function useEstilos() {
  const c = useC();
  return useMemo(() => crearEstilos(c), [c]);
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    cabecera: { alignItems: 'center', gap: 4, marginTop: 12, marginBottom: 8 },
    circulo: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tinte(c.primary, 0.16),
      marginBottom: 6,
    },
    circuloEmoji: { fontSize: 38 },
    marca: { fontSize: 15, fontWeight: '800', color: c.primary },
    frase: { fontSize: 13, color: c.muted },
    titulo: { fontSize: 26, fontWeight: '800', color: c.text, marginTop: 14, textAlign: 'center' },
    banda: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1, padding: 16 },
    bandaEmoji: { fontSize: 28 },
    bandaTxt: { flex: 1, fontSize: 15, lineHeight: 21, color: c.text },
    enlace: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    enlaceTxt: { fontSize: 15, fontWeight: '700', color: c.muted },
    pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
    piePregunta: { fontSize: 14, color: c.muted },
    pieBoton: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pieBotonTxt: { fontSize: 15, fontWeight: '700', color: c.primary },
  });
