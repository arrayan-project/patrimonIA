import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { PlantillaMovimientoService } from './plantilla-movimiento.service.js';
import {
  ActualizarPlantillaMovimientoDto,
  CrearPlantillaMovimientoDto,
  EliminarPlantillaMovimientoDto,
} from './dto/plantilla-movimiento.dto.js';

@Controller()
export class PlantillaMovimientoController {
  constructor(private readonly plantillas: PlantillaMovimientoService) {}

  @Post('comandos/CrearPlantillaMovimiento')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearPlantillaMovimientoDto) {
    return this.plantillas.crear(u.id, dto);
  }

  @Post('comandos/ActualizarPlantillaMovimiento')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarPlantillaMovimientoDto) {
    return this.plantillas.actualizar(u.id, dto);
  }

  @Post('comandos/EliminarPlantillaMovimiento')
  @HttpCode(200)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarPlantillaMovimientoDto) {
    return this.plantillas.eliminar(u.id, dto);
  }

  @Get('usuarios/me/plantillas-movimiento')
  listar(@CurrentUser() u: UsuarioAutenticado) {
    return this.plantillas.listar(u.id);
  }
}
