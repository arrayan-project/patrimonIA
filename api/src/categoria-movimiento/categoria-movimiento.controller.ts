import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { CategoriaMovimientoService } from './categoria-movimiento.service.js';
import {
  ActualizarCategoriaMovimientoDto,
  ArchivarCategoriaMovimientoDto,
  CrearCategoriaMovimientoDto,
  ReordenarCategoriasMovimientoDto,
} from './dto/categoria-movimiento.dto.js';

@Controller()
export class CategoriaMovimientoController {
  constructor(private readonly categorias: CategoriaMovimientoService) {}

  @Post('comandos/CrearCategoriaMovimiento')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearCategoriaMovimientoDto) {
    return this.categorias.crear(u.id, dto);
  }

  @Post('comandos/ActualizarCategoriaMovimiento')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarCategoriaMovimientoDto) {
    return this.categorias.actualizar(u.id, dto);
  }

  @Post('comandos/ArchivarCategoriaMovimiento')
  @HttpCode(200)
  archivar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ArchivarCategoriaMovimientoDto) {
    return this.categorias.archivar(u.id, dto);
  }

  @Post('comandos/ReordenarCategoriasMovimiento')
  @HttpCode(200)
  reordenar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ReordenarCategoriasMovimientoDto) {
    return this.categorias.reordenar(u.id, dto);
  }

  @Get('hogares/:id/categorias-movimiento')
  listar(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('incluirArchivadas') incluirArchivadas?: string,
  ) {
    return this.categorias.listar(id, u.id, incluirArchivadas === 'true');
  }
}
