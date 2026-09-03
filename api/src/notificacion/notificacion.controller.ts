import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { NotificacionService } from './notificacion.service.js';

@Controller()
export class NotificacionController {
  constructor(private readonly notificaciones: NotificacionService) {}

  @Get('usuarios/me/notificaciones')
  listar(@CurrentUser() u: UsuarioAutenticado, @Query('leida') leida?: string) {
    return this.notificaciones.listar(u.id, leida === 'false');
  }

  @Get('usuarios/me/notificaciones/no-leidas')
  contar(@CurrentUser() u: UsuarioAutenticado) {
    return this.notificaciones.contarNoLeidas(u.id);
  }

  @Post('usuarios/me/notificaciones/:id/leer')
  @HttpCode(200)
  leer(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificaciones.marcarLeida(u.id, id);
  }

  @Post('usuarios/me/notificaciones/leer-todas')
  @HttpCode(200)
  leerTodas(@CurrentUser() u: UsuarioAutenticado) {
    return this.notificaciones.marcarTodasLeidas(u.id);
  }
}
