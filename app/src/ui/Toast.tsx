import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useC } from './tema';

type Tono = 'ok' | 'error';
interface ToastCtx {
  mostrar: (mensaje: string, tono?: Tono) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useC();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ texto: string; tono: Tono } | null>(null);
  const opacidad = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback(
    (mensaje: string, tono: Tono = 'ok') => {
      if (timer.current) clearTimeout(timer.current);
      setMsg({ texto: mensaje, tono });
      Animated.timing(opacidad, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacidad, { toValue: 0, duration: 250, useNativeDriver: true }).start(
          () => setMsg(null),
        );
      }, 2600);
    },
    [opacidad],
  );

  return (
    <Ctx.Provider value={{ mostrar }}>
      {children}
      {msg && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              backgroundColor: msg.tono === 'error' ? c.danger : c.primary,
              // Arriba, bajo la barra: abajo tapaba el botón fijo de los formularios.
              top: insets.top + 64,
              opacity: opacidad,
            },
          ]}
        >
          <Text style={[styles.texto, { color: msg.tono === 'error' ? '#fff' : c.primaryText }]}>
            {msg.texto}
          </Text>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

/** Devuelve `mostrar(mensaje, 'ok' | 'error')`. Sin provider, es un no-op. */
export function useToast(): ToastCtx {
  return useContext(Ctx) ?? { mostrar: () => undefined };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  texto: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
