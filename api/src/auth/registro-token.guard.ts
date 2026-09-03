import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Puerta del pre-registro (API_DESIGN: "token de sesión temporal de registro").
 * Solo exige el token si `AUTH_REGISTRO_TOKEN_REQUERIDO=true` — en dev/test queda
 * abierto. El gate previo real (captcha / verificación de email) antes de emitir
 * el token queda pendiente (GAPS.md G4).
 */
@Injectable()
export class RegistroTokenGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.AUTH_REGISTRO_TOKEN_REQUERIDO !== 'true') return true;

    const req = context.switchToHttp().getRequest();
    const token: string | undefined =
      req.headers['x-registro-token'] ?? req.headers['authorization']?.replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('Falta el token de registro');

    try {
      const payload = await this.jwt.verifyAsync<{ purpose?: string }>(token);
      if (payload.purpose !== 'registro') throw new Error('propósito inválido');
    } catch {
      throw new UnauthorizedException('Token de registro inválido o expirado');
    }
    return true;
  }
}
