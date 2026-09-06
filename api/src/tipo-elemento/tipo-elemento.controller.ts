import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { TipoElementoService } from './tipo-elemento.service.js';
import {
  ActualizarTipoElementoDto,
  ArchivarTipoElementoDto,
  CrearTipoElementoDto,
  ReordenarTiposElementoDto,
} from './dto/tipo-elemento.dto.js';

@Controller()
export class TipoElementoController {
  constructor(private readonly tipos: TipoElementoService) {}

  @Post('comandos/CrearTipoElemento')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearTipoElementoDto) {
    return this.tipos.crear(u.id, dto);
  }

  @Post('comandos/ActualizarTipoElemento')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarTipoElementoDto) {
    return this.tipos.actualizar(u.id, dto);
  }

  @Post('comandos/ArchivarTipoElemento')
  @HttpCode(200)
  archivar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ArchivarTipoElementoDto) {
    return this.tipos.archivar(u.id, dto);
  }

  @Post('comandos/ReordenarTiposElemento')
  @HttpCode(200)
  reordenar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ReordenarTiposElementoDto) {
    return this.tipos.reordenar(u.id, dto);
  }

  @Get('hogares/:id/tipos-elemento')
  listar(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('incluirArchivados') incluirArchivados?: string,
  ) {
    return this.tipos.listar(id, u.id, incluirArchivados === 'true');
  }
}
