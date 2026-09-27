import { Injectable, Logger } from '@nestjs/common';

export interface PushSender {
  /** Devuelve los tokens que el proveedor reporta como no registrados (a olvidar). */
  enviar(expoPushTokens: string[], titulo: string, cuerpo: string): Promise<string[]>;
}

export const PUSH_SENDER = Symbol('PushSender');

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/**
 * Envío de push por la Expo Push API (no requiere credenciales para el envío
 * básico). Best-effort: cualquier fallo se loguea y no propaga. En producción
 * puede reemplazarse por FCM/APNs directo cambiando el provider `PUSH_SENDER`.
 *
 * G20 — reintenta ante error de red, 429 o 5xx (un intento por cada entrada de
 * `reintentosMs`, esperando ese tiempo antes). Un 4xx distinto de 429 no se
 * reintenta. Los tickets `DeviceNotRegistered` se devuelven para borrar el token.
 */
@Injectable()
export class ExpoPushSender implements PushSender {
  private readonly logger = new Logger('PushSender');
  reintentosMs = [1000, 4000];

  async enviar(tokens: string[], titulo: string, cuerpo: string): Promise<string[]> {
    const validos = tokens.filter((t) => t.startsWith('ExponentPushToken['));
    if (validos.length === 0) return [];
    const body = JSON.stringify(
      validos.map((to) => ({ to, title: titulo, body: cuerpo, sound: 'default' })),
    );

    for (let intento = 0; ; intento++) {
      let motivo: string;
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
        });
        if (res.ok) return this.#noRegistrados(validos, await res.json().catch(() => null));
        if (res.status !== 429 && res.status < 500) {
          this.logger.warn(`Expo push respondió ${res.status}`);
          return [];
        }
        motivo = `respondió ${res.status}`;
      } catch (e) {
        motivo = (e as Error).message;
      }
      if (intento >= this.reintentosMs.length) {
        this.logger.warn(`No se pudo enviar push tras ${intento + 1} intentos: ${motivo}`);
        return [];
      }
      await new Promise((r) => setTimeout(r, this.reintentosMs[intento]));
    }
  }

  /** Los tickets vienen en el mismo orden que los mensajes enviados. */
  #noRegistrados(tokens: string[], respuesta: unknown): string[] {
    const tickets = (respuesta as { data?: ExpoTicket[] } | null)?.data;
    if (!Array.isArray(tickets)) return [];
    return tokens.filter(
      (_, i) =>
        tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered',
    );
  }
}
