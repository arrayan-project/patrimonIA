/**
 * URL del backend. En un dispositivo físico `localhost` NO resuelve al PC —
 * exportar EXPO_PUBLIC_API_URL con la IP LAN, p. ej.:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.50:3000 npm start
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
