import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { PresupuestoService } from './presupuesto.service.js';
import {
  ActualizarPresupuestoDto,
  CerrarPresupuestoDto,
  CrearPresupuestoDto,
  EliminarPresupuestoDto,
} from './dto/presupuesto.dto.js';

@Controller()
export class PresupuestoController {
  constructor(private readonly presupuestos: PresupuestoService) {}

  @Post('comandos/CrearPresupuesto')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearPresupuestoDto) {
    return this.presupuestos.crear(u.id, dto);
  }

  @Post('comandos/ActualizarDatosPresupuesto')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarPresupuestoDto) {
    return this.presupuestos.actualizar(u.id, dto);
  }

  @Post('comandos/CerrarPresupuesto')
  @HttpCode(200)
  cerrar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CerrarPresupuestoDto) {
    return this.presupuestos.cerrar(u.id, dto);
  }

  @Post('comandos/EliminarPresupuesto')
  @HttpCode(200)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarPresupuestoDto) {
    return this.presupuestos.eliminar(u.id, dto);
  }

  @Get('presupuestos')
  listar(
    @CurrentUser() u: UsuarioAutenticado,
    @Query('tipo') tipo?: string,
    @Query('vigente') vigente?: string,
  ) {
    return this.presupuestos.listar(u.id, tipo, vigente === 'true');
  }

  @Get('presupuestos/:id')
  obtener(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestos.obtener(id, u.id);
  }

  @Get('presupuestos/:id/desviacion')
  desviacion(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestos.desviacion(id, u.id);
  }
}
