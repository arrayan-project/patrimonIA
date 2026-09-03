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

    let payload: { purpose?: string; email?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token de registro inválido o expirado');
    }
    if (payload.purpose !== 'registro') {
      throw new UnauthorizedException('Token de registro inválido o expirado');
    }
    // Si el token se emitió para un email concreto, debe coincidir con el del alta.
    const emailAlta = String(req.body?.email ?? '').toLowerCase();
    if (payload.email && payload.email !== emailAlta) {
      throw new UnauthorizedException('El token de registro es de otro email');
    }
    return true;
  }
}
