import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';

/**
 * Obtiene el Expo push token del dispositivo. Devuelve null en web, en
 * simulador, sin permiso, o si falta el projectId de EAS (requiere un
 * development build). En Expo Go devuelve null sin cargar expo-notifications:
 * desde el SDK 53, en Android el módulo falla apenas se importa y la app no
 * arranca ("runtime not ready").
 */
export async function obtenerExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
    const Notifications = await import('expo-notifications');

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
