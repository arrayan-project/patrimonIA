import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from '../common/password.js';
import { EMAIL_SENDER, type EmailSender } from './email-sender.js';
import type { JwtPayload } from './jwt-payload.js';

const REGISTRO_TOKEN_REQUERIDO = () => process.env.AUTH_REGISTRO_TOKEN_REQUERIDO === 'true';

export interface LoginResult {
  accessToken: string;
  usuario: { id: string; email: string; nombre: string };
}

/**
 * Autenticación — infraestructura, no dominio. No hay comando "IniciarSesion"
 * en el catálogo (DDD Sección T); el login solo emite el JWT que los comandos
 * exigen.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!(await verifyPassword(password, usuario.password_hash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = { sub: usuario.id, email: usuario.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    };
  }

  /**
   * Token de sesión temporal de registro (API_DESIGN). Corto (15 min) y con
   * propósito acotado. Si se da un email, el token queda ligado a él y se envía
   * por correo; en modo requerido (prod) el token NO se devuelve en la respuesta,
   * solo llega al email. El captcha/otro gate anti-bots antes de esto sigue
   * pendiente (GAPS.md G4) — el rate-limit por IP se aplica en el controller.
   */
  async emitirTokenRegistro(
    email?: string,
  ): Promise<{ token: string; expiraEn: string } | { enviado: true }> {
    const claims: Record<string, unknown> = { purpose: 'registro' };
    if (email) claims.email = email.toLowerCase();
    const token = await this.jwt.signAsync(claims, { expiresIn: '15m' });

    if (email) {
      await this.email.enviar(
        email,
        'Tu código de registro en PatrimonIA',
        `Usa este token para completar tu registro (vence en 15 minutos):\n\n${token}`,
      );
    }

    if (REGISTRO_TOKEN_REQUERIDO()) return { enviado: true };
    return { token, expiraEn: '15m' };
  }
}
