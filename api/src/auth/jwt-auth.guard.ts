import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { JwtPayload, UsuarioAutenticado } from './jwt-payload.js';

/**
 * Exige `Authorization: Bearer <jwt>` en todo endpoint (API_DESIGN — sin
 * excepción), salvo los marcados @Public(). La autorización por rol NO se hace
 * aquí: vive dentro de cada Application Service (API_DESIGN, "Autorización").
 * Rechaza tokens de propósito acotado (registro, reset) y sesiones cuyo `tv` ya
 * no coincide con usuario.token_version — p. ej. emitidas antes de un reset de
 * contraseña (GAPS.md G31).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user: UsuarioAutenticado }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token Bearer');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    if (payload.purpose || !payload.sub) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { token_version: true },
    });
    if (!usuario || usuario.token_version !== (payload.tv ?? 0)) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    request.user = { id: payload.sub, email: payload.email };
    return true;
  }
}
