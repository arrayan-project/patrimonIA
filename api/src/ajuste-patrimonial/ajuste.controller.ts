import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarAjusteDto } from './dto/registrar-ajuste.dto.js';
import { AnularAjusteDto } from './dto/anular-ajuste.dto.js';
import { CorregirAjusteDto } from './dto/corregir-ajuste.dto.js';
import { AjustePatrimonialService } from './ajuste.service.js';
import type { AjustePatrimonialDTO } from './ajuste.dto.js';

@Controller()
export class AjustePatrimonialController {
  constructor(private readonly ajustes: AjustePatrimonialService) {}

  @Post('comandos/RegistrarAjustePatrimonial')
  registrar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: RegistrarAjusteDto,
  ): Promise<AjustePatrimonialDTO> {
    return this.ajustes.registrarAjuste(user.id, dto);
  }

  @Post('comandos/AnularAjustePatrimonial')
  @HttpCode(200)
  anular(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: AnularAjusteDto,
  ): Promise<AjustePatrimonialDTO> {
    return this.ajustes.anularAjuste(user.id, dto);
  }

  @Post('comandos/CorregirAjustePatrimonial')
  corregir(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: CorregirAjusteDto,
  ): Promise<AjustePatrimonialDTO> {
    return this.ajustes.corregirAjuste(user.id, dto);
  }

  @Get('ajustes-patrimoniales')
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('elemento') elemento?: string,
  ): Promise<AjustePatrimonialDTO[]> {
    if (!elemento) throw new BadRequestException('Falta el parámetro ?elemento=<id>');
    return this.ajustes.listarPorElemento(elemento, user.id);
  }
}
