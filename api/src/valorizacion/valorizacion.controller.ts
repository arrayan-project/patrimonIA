import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarValorizacionDto } from './dto/registrar-valorizacion.dto.js';
import { AnularValorizacionDto } from './dto/anular-valorizacion.dto.js';
import { CorregirValorizacionDto } from './dto/corregir-valorizacion.dto.js';
import { ValorizacionService } from './valorizacion.service.js';
import type { ValorizacionDTO } from './valorizacion.dto.js';

@Controller()
export class ValorizacionController {
  constructor(private readonly valorizaciones: ValorizacionService) {}

  @Post('comandos/RegistrarValorizacion')
  registrar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: RegistrarValorizacionDto,
  ): Promise<ValorizacionDTO> {
    return this.valorizaciones.registrarValorizacion(user.id, dto);
  }

  @Post('comandos/AnularValorizacion')
  @HttpCode(200)
  anular(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: AnularValorizacionDto,
  ): Promise<ValorizacionDTO> {
    return this.valorizaciones.anularValorizacion(user.id, dto);
  }

  @Post('comandos/CorregirValorizacion')
  corregir(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: CorregirValorizacionDto,
  ): Promise<ValorizacionDTO> {
    return this.valorizaciones.corregirValorizacion(user.id, dto);
  }

  @Get('elementos-patrimoniales/:id/valorizaciones')
  historial(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ValorizacionDTO[]> {
    return this.valorizaciones.listarPorElemento(id, user.id);
  }
}
