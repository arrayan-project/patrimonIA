import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from '../common/password.js';
import { EMAIL_SENDER, type EmailSender } from './email-sender.js';
import { CODIGO_VIGENCIA_MIN, CodigoVerificacionService } from './codigo-verificacion.service.js';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    private readonly codigos: CodigoVerificacionService,
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
   * propósito acotado. Si se da un email, se le envía un código de 6 dígitos que
   * se canjea por el token en `verificarCodigoRegistro` (G4); en modo requerido
   * (prod) el token NO se devuelve en la respuesta, solo el email permite
   * obtenerlo. El captcha/otro gate anti-bots antes de esto sigue pendiente
   * (GAPS.md G4) — el rate-limit por IP se aplica en el controller.
   */
  async emitirTokenRegistro(
    email?: string,
  ): Promise<{ token: string; expiraEn: string } | { enviado: true }> {
    if (email) {
      const codigo = await this.codigos.emitir(email.toLowerCase(), 'REGISTRO');
      await this.email.enviar(
        email,
        'Tu código de registro en PatrimonIA',
        `Tu código para completar el registro es:\n\n${codigo}\n\n` +
          `Vence en ${CODIGO_VIGENCIA_MIN} minutos.`,
      );
    }

    if (REGISTRO_TOKEN_REQUERIDO()) return { enviado: true };
    return this.#firmarTokenRegistro(email);
  }

  /** Canjea el código de 6 dígitos enviado por email por el token de registro (G4). */
  async verificarCodigoRegistro(email: string, codigo: string): Promise<{ token: string; expiraEn: string }> {
    if (!(await this.codigos.verificar(email, 'REGISTRO', codigo))) {
      throw new UnauthorizedException('Código inválido o expirado');
    }
    return this.#firmarTokenRegistro(email);
  }

  async #firmarTokenRegistro(email?: string): Promise<{ token: string; expiraEn: string }> {
    const claims: Record<string, unknown> = { purpose: 'registro' };
    if (email) claims.email = email.toLowerCase();
    return { token: await this.jwt.signAsync(claims, { expiresIn: '15m' }), expiraEn: '15m' };
  }

  /**
   * Reset de contraseña, paso 1 (GAPS.md G31). Envía por email un código de 6
   * dígitos (15 min, 5 intentos). La respuesta es la misma exista o no el email
   * (no revela qué cuentas existen) y el código nunca se devuelve en la
   * respuesta, ni siquiera en dev: solo llega al email (en dev,
   * ConsoleEmailSender lo deja en el log).
   */
  async solicitarResetPassword(email: string): Promise<{ enviado: true }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (usuario && usuario.estado === 'ACTIVO') {
      const codigo = await this.codigos.emitir(usuario.email, 'RESET');
      // Un fallo de envío no se propaga: un 500 solo para emails existentes
      // revelaría qué cuentas existen.
      await this.email
        .enviar(
          usuario.email,
          'Restablecer tu contraseña de PatrimonIA',
          `Tu código para elegir una nueva contraseña es:\n\n${codigo}\n\n` +
            `Vence en ${CODIGO_VIGENCIA_MIN} minutos. Si no lo pediste, ignora este correo: tu contraseña no cambia.`,
        )
        .catch((e: unknown) => this.logger.error(`No se pudo enviar el email de reset: ${String(e)}`));
    }
    return { enviado: true };
  }

  /**
   * Reset de contraseña, paso 2. Valida (y consume) el código y actualiza el
   * hash. Incrementar token_version cierra todas las sesiones abiertas
   * (JwtAuthGuard compara `tv`).
   */
  async resetPassword(email: string, codigo: string, nuevaPassword: string): Promise<{ ok: true }> {
    if (!(await this.codigos.verificar(email, 'RESET', codigo))) {
      throw new UnauthorizedException('Código inválido o expirado');
    }
    const passwordHash = await hashPassword(nuevaPassword);
    const { count } = await this.prisma.usuario.updateMany({
      where: { email, estado: 'ACTIVO' },
      data: { password_hash: passwordHash, token_version: { increment: 1 } },
    });
    if (count !== 1) throw new UnauthorizedException('Código inválido o expirado');
    return { ok: true };
  }
}
