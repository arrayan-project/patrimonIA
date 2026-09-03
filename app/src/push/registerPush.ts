import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

/**
 * Obtiene el Expo push token del dispositivo. Devuelve null en web, en
 * simulador, sin permiso, o si falta el projectId de EAS (requiere un
 * development build — en Expo Go SDK 53+ el push remoto está limitado).
 */
export async function obtenerExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data ?? null;
  } catch {
    return null;
  }
}
