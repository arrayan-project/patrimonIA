import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Almacenamiento del token de sesión. `expo-secure-store` en nativo (Keychain /
 * Keystore); `localStorage` en web (SecureStore no soporta web). Cualquier fallo
 * degrada a "sin persistencia" sin romper la app.
 */
const esWeb = Platform.OS === 'web';

export async function guardar(clave: string, valor: string): Promise<void> {
  try {
    if (esWeb) {
      globalThis.localStorage?.setItem(clave, valor);
    } else {
      await SecureStore.setItemAsync(clave, valor);
    }
  } catch {
    // sin persistencia
  }
}

export async function leer(clave: string): Promise<string | null> {
  try {
    if (esWeb) return globalThis.localStorage?.getItem(clave) ?? null;
    return await SecureStore.getItemAsync(clave);
  } catch {
    return null;
  }
}

export async function borrar(clave: string): Promise<void> {
  try {
    if (esWeb) {
      globalThis.localStorage?.removeItem(clave);
    } else {
      await SecureStore.deleteItemAsync(clave);
    }
  } catch {
    // no-op
  }
}
