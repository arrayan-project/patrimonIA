import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { MovimientoProgramadoService } from './movimiento-programado.service.js';
import {
  ActualizarMovimientoProgramadoDto,
  CancelarMovimientoProgramadoDto,
  CrearMovimientoProgramadoDto,
  MaterializarMovimientoProgramadoDto,
} from './dto/movimiento-programado.dto.js';

@Controller()
export class MovimientoProgramadoController {
  constructor(private readonly movimientos: MovimientoProgramadoService) {}

  @Post('comandos/CrearMovimientoProgramado')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearMovimientoProgramadoDto) {
    return this.movimientos.crear(u.id, dto);
  }

  @Post('comandos/ActualizarMovimientoProgramado')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarMovimientoProgramadoDto) {
    return this.movimientos.actualizar(u.id, dto);
  }

  @Post('comandos/MaterializarMovimientoProgramado')
  @HttpCode(200)
  materializar(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: MaterializarMovimientoProgramadoDto,
  ) {
    return this.movimientos.materializar(u.id, dto);
  }

  @Post('comandos/CancelarMovimientoProgramado')
  @HttpCode(200)
  cancelar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CancelarMovimientoProgramadoDto) {
    return this.movimientos.cancelar(u.id, dto);
  }

  @Get('movimientos-programados')
  listar(@CurrentUser() u: UsuarioAutenticado, @Query('estado') estado?: string) {
    return this.movimientos.listar(u.id, estado);
  }

  @Get('movimientos-programados/:id')
  obtener(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.movimientos.obtener(id, u.id);
  }
}
