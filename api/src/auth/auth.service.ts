import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../common/password.js';
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

    const payload: JwtPayload = { sub: usuario.id, email: usuario.email, tv: usuario.token_version };
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

  /**
   * Reset de contraseña, paso 1 (GAPS.md G31). Emite un token de propósito
   * `reset` (30 min) ligado a usuario.token_version y lo envía por email. La
   * respuesta es la misma exista o no el email (no revela qué cuentas existen)
   * y el token nunca se devuelve en la respuesta, ni siquiera en dev: solo llega
   * al email (en dev, ConsoleEmailSender lo deja en el log).
   */
  async solicitarResetPassword(email: string): Promise<{ enviado: true }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (usuario && usuario.estado === 'ACTIVO') {
      const claims: JwtPayload = {
        sub: usuario.id,
        email: usuario.email,
        tv: usuario.token_version,
        purpose: 'reset',
      };
      const token = await this.jwt.signAsync(claims, { expiresIn: '30m' });
      await this.email.enviar(
        usuario.email,
        'Restablecer tu contraseña de PatrimonIA',
        `Usa este token para elegir una nueva contraseña (vence en 30 minutos):\n\n${token}\n\n` +
          'Si no lo pediste, ignora este correo: tu contraseña no cambia.',
      );
    }
    return { enviado: true };
  }

  /**
   * Reset de contraseña, paso 2. Valida el token y actualiza el hash. Incrementar
   * token_version hace el token de un solo uso y cierra todas las sesiones
   * abiertas (JwtAuthGuard compara `tv`).
   */
  async resetPassword(token: string, nuevaPassword: string): Promise<{ ok: true }> {
    const invalido = () => new UnauthorizedException('Token de reset inválido o expirado');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw invalido();
    }
    if (payload.purpose !== 'reset' || !payload.sub) throw invalido();

    const passwordHash = await hashPassword(nuevaPassword);
    // El filtro por token_version en el UPDATE hace atómico el "un solo uso":
    // dos requests con el mismo token no pueden ganar ambos.
    const { count } = await this.prisma.usuario.updateMany({
      where: { id: payload.sub, estado: 'ACTIVO', token_version: payload.tv ?? 0 },
      data: { password_hash: passwordHash, token_version: { increment: 1 } },
    });
    if (count !== 1) throw invalido();
    return { ok: true };
  }
}
