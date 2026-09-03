import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { NotificacionService } from './notificacion.service.js';

class DispositivoPushDto {
  @IsString()
  @MinLength(10)
  expoPushToken!: string;
}

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

  @Post('usuarios/me/dispositivos-push')
  @HttpCode(200)
  registrarDispositivo(@CurrentUser() u: UsuarioAutenticado, @Body() dto: DispositivoPushDto) {
    return this.notificaciones.registrarDispositivo(u.id, dto.expoPushToken);
  }

  @Delete('usuarios/me/dispositivos-push')
  @HttpCode(200)
  olvidarDispositivo(@CurrentUser() u: UsuarioAutenticado, @Body() dto: DispositivoPushDto) {
    return this.notificaciones.olvidarDispositivo(u.id, dto.expoPushToken);
  }
}
