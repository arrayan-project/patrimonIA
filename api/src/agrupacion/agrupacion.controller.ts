import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { AgrupacionService } from './agrupacion.service.js';
import {
  ActualizarAgrupacionDto,
  CrearAgrupacionDto,
  DefinirElementosAgrupacionDto,
  EliminarAgrupacionDto,
} from './dto/agrupacion.dto.js';

@Controller()
export class AgrupacionController {
  constructor(private readonly agrupaciones: AgrupacionService) {}

  @Post('comandos/CrearAgrupacion')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearAgrupacionDto) {
    return this.agrupaciones.crear(u.id, dto);
  }

  @Post('comandos/ActualizarAgrupacion')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarAgrupacionDto) {
    return this.agrupaciones.actualizar(u.id, dto);
  }

  @Post('comandos/EliminarAgrupacion')
  @HttpCode(200)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarAgrupacionDto) {
    return this.agrupaciones.eliminar(u.id, dto);
  }

  @Post('comandos/DefinirElementosAgrupacion')
  @HttpCode(200)
  definir(@CurrentUser() u: UsuarioAutenticado, @Body() dto: DefinirElementosAgrupacionDto) {
    return this.agrupaciones.definirElementos(u.id, dto);
  }

  @Get('usuarios/me/agrupaciones')
  listar(@CurrentUser() u: UsuarioAutenticado) {
    return this.agrupaciones.listar(u.id);
  }
}
