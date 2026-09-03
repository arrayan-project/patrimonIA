import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from '../common/password.js';
import type { JwtPayload } from './jwt-payload.js';

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
   * Token de sesión temporal de registro (API_DESIGN). Corto y con propósito
   * acotado. El gate previo (captcha / email) queda pendiente — ver GAPS.md G4.
   */
  async emitirTokenRegistro(): Promise<{ token: string; expiraEn: string }> {
    return {
      token: await this.jwt.signAsync({ purpose: 'registro' }, { expiresIn: '15m' }),
      expiraEn: '15m',
    };
  }
}
