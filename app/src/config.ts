import Constants from 'expo-constants';

/**
 * URL del backend.
 *
 * 1. Si defines EXPO_PUBLIC_API_URL, se usa tal cual.
 * 2. Si no, se infiere del PC donde corre Expo (misma IP LAN que te muestra
 *    `npx expo start`), asumiendo el backend en el puerto 3000. Esto hace que
 *    funcione en un teléfono real sin configurar nada, siempre que el back
 *    escuche en 0.0.0.0:3000 y estés en la misma red WiFi.
 * 3. Fallback: localhost (emulador / navegador en el mismo PC).
 */
function inferirApiUrl(): string {
  const explicita = process.env.EXPO_PUBLIC_API_URL;
  if (explicita) return explicita;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  return 'http://localhost:3000';
}

export const API_URL = inferirApiUrl();
