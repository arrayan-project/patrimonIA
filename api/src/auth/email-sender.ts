import { Injectable, Logger } from '@nestjs/common';

export interface EmailSender {
  enviar(destinatario: string, asunto: string, cuerpo: string): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EmailSender');

/**
 * Implementación por defecto: escribe el email en el log. Suficiente para
 * dev/test. En producción se reemplaza el provider `EMAIL_SENDER` por uno real
 * (Resend, SES, SendGrid…) sin tocar el resto del código (GAPS.md G4).
 */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger('EmailSender');

  async enviar(destinatario: string, asunto: string, cuerpo: string): Promise<void> {
    this.logger.log(`→ ${destinatario} · "${asunto}"\n${cuerpo}`);
  }
}
