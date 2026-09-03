import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { EtiquetaService } from './etiqueta.service.js';
import {
  ActualizarEtiquetaDto,
  CrearEtiquetaDto,
  EliminarEtiquetaDto,
  EtiquetarEventoDto,
} from './dto/etiqueta.dto.js';

@Controller()
export class EtiquetaController {
  constructor(private readonly etiquetas: EtiquetaService) {}

  @Post('comandos/CrearEtiqueta')
  crear(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearEtiquetaDto) {
    return this.etiquetas.crear(u.id, dto);
  }

  @Post('comandos/ActualizarEtiqueta')
  @HttpCode(200)
  actualizar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarEtiquetaDto) {
    return this.etiquetas.actualizar(u.id, dto);
  }

  @Post('comandos/EliminarEtiqueta')
  @HttpCode(200)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarEtiquetaDto) {
    return this.etiquetas.eliminar(u.id, dto);
  }

  @Post('comandos/EtiquetarEvento')
  @HttpCode(200)
  etiquetar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EtiquetarEventoDto) {
    return this.etiquetas.etiquetarEvento(u.id, dto);
  }

  @Get('usuarios/me/etiquetas')
  listar(@CurrentUser() u: UsuarioAutenticado) {
    return this.etiquetas.listar(u.id);
  }
}
