import { Alert, Platform } from 'react-native';

/**
 * Diálogo de confirmación para acciones destructivas. Resuelve `true` si el
 * usuario acepta. En nativo usa `Alert`; en web, `window.confirm`.
 */
export function confirmar(
  titulo: string,
  mensaje: string,
  textoAceptar = 'Confirmar',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof globalThis.confirm === 'function' ? globalThis.confirm(`${titulo}\n\n${mensaje}`) : true,
    );
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: textoAceptar, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
