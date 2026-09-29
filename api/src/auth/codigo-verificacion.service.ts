import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

export type PropositoCodigo = 'REGISTRO' | 'RESET';

export const CODIGO_VIGENCIA_MIN = 15;
export const CODIGO_MAX_INTENTOS = 5;

/**
 * Códigos de 6 dígitos enviados por email para el registro (G4) y el reset de
 * contraseña (G31). Reemplazan al JWT completo que había que copiar y pegar.
 * Solo se guarda un HMAC del código; vence en 15 min y admite 5 intentos, así
 * que no se puede adivinar por fuerza bruta. Pedir uno nuevo reemplaza al
 * anterior (PK email + propósito). Infraestructura, no dominio.
 */
@Injectable()
export class CodigoVerificacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Genera un código nuevo para (email, propósito) y lo devuelve en claro para enviarlo. */
  async emitir(email: string, proposito: PropositoCodigo): Promise<string> {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const datos = {
      codigo_hash: this.#hash(email, proposito, codigo),
      expira_en: new Date(Date.now() + CODIGO_VIGENCIA_MIN * 60 * 1000),
      intentos: 0,
      created_at: new Date(),
    };
    await this.prisma.codigo_verificacion.upsert({
      where: { email_proposito: { email, proposito } },
      create: { email, proposito, ...datos },
      update: datos,
    });
    return codigo;
  }

  /**
   * true si el código es el vigente para (email, propósito); en ese caso lo
   * consume. Cada llamada cuenta como intento, acierte o no.
   */
  async verificar(email: string, proposito: PropositoCodigo, codigo: string): Promise<boolean> {
    // Sumar el intento primero y en el mismo UPDATE que filtra por vigencia y
    // tope evita que requests concurrentes se salten el límite.
    const { count } = await this.prisma.codigo_verificacion.updateMany({
      where: { email, proposito, expira_en: { gt: new Date() }, intentos: { lt: CODIGO_MAX_INTENTOS } },
      data: { intentos: { increment: 1 } },
    });
    if (count !== 1) return false;

    // Borrar filtrando por el hash consume el código de forma atómica: si dos
    // requests aciertan a la vez, solo una borra la fila.
    const borrado = await this.prisma.codigo_verificacion.deleteMany({
      where: { email, proposito, codigo_hash: this.#hash(email, proposito, codigo) },
    });
    return borrado.count === 1;
  }

  #hash(email: string, proposito: PropositoCodigo, codigo: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${proposito}:${email}:${codigo}`)
      .digest('hex');
  }
}
