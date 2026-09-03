import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UsuarioAutenticado } from './jwt-payload.js';

/** Inyecta el usuario autenticado (puesto en el request por JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx.switchToHttp().getRequest<Request & { user: UsuarioAutenticado }>();
    return request.user;
  },
);
