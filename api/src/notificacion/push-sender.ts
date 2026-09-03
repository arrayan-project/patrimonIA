import { Injectable, Logger } from '@nestjs/common';

export interface PushSender {
  enviar(expoPushTokens: string[], titulo: string, cuerpo: string): Promise<void>;
}

export const PUSH_SENDER = Symbol('PushSender');

/**
 * Envío de push por la Expo Push API (no requiere credenciales para el envío
 * básico). Best-effort: cualquier fallo se loguea y no propaga. En producción
 * puede reemplazarse por FCM/APNs directo cambiando el provider `PUSH_SENDER`.
 */
@Injectable()
export class ExpoPushSender implements PushSender {
  private readonly logger = new Logger('PushSender');

  async enviar(tokens: string[], titulo: string, cuerpo: string): Promise<void> {
    const validos = tokens.filter((t) => t.startsWith('ExponentPushToken['));
    if (validos.length === 0) return;
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          validos.map((to) => ({ to, title: titulo, body: cuerpo, sound: 'default' })),
        ),
      });
      if (!res.ok) this.logger.warn(`Expo push respondió ${res.status}`);
    } catch (e) {
      this.logger.warn(`No se pudo enviar push: ${(e as Error).message}`);
    }
  }
}
