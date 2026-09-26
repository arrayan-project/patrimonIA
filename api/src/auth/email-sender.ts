import { Injectable, Logger } from '@nestjs/common';

export interface EmailSender {
  enviar(destinatario: string, asunto: string, cuerpo: string): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EmailSender');

/**
 * Implementación por defecto: escribe el email en el log. Suficiente para
 * dev/test. Si hay `BREVO_API_KEY`, AuthModule usa BrevoEmailSender en su lugar.
 */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('EmailSender');

  async enviar(destinatario: string, asunto: string, cuerpo: string): Promise<void> {
    this.logger.log(`→ ${destinatario} · "${asunto}"\n${cuerpo}`);
  }
}

/**
 * Envío real vía la API transaccional de Brevo (fetch, sin SDK). Sin dominio
 * propio, el remitente es un email verificado a mano en Brevo (Senders).
 * Env: BREVO_API_KEY, EMAIL_REMITENTE, EMAIL_REMITENTE_NOMBRE (opcional).
 */
export class BrevoEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly remitente: { email: string; name: string },
  ) {}

  async enviar(destinatario: string, asunto: string, cuerpo: string): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: this.remitente,
        to: [{ email: destinatario }],
        subject: asunto,
        textContent: cuerpo,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Brevo respondió ${res.status}: ${await res.text()}`);
    }
  }
}

/** Elige el sender según el entorno: Brevo si hay API key, consola si no. */
export function crearEmailSender(env: NodeJS.ProcessEnv = process.env): EmailSender {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return new ConsoleEmailSender();
  const email = env.EMAIL_REMITENTE;
  if (!email) throw new Error('BREVO_API_KEY definida sin EMAIL_REMITENTE');
  return new BrevoEmailSender(apiKey, { email, name: env.EMAIL_REMITENTE_NOMBRE ?? 'PatrimonIA' });
}
