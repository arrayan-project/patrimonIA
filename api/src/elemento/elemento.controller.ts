import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarElementoDto } from './dto/registrar-elemento.dto.js';
import { ElementoService } from './elemento.service.js';
import type { ElementoPatrimonialDTO, ImpactoPatrimonialDTO } from './elemento.dto.js';

@Controller()
export class ElementoController {
  constructor(private readonly elementos: ElementoService) {}

  @Post('comandos/RegistrarElementoPatrimonial')
  registrar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: RegistrarElementoDto,
  ): Promise<ElementoPatrimonialDTO> {
    return this.elementos.registrarElemento(user.id, dto);
  }

  @Get('elementos-patrimoniales')
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('propietario') propietario?: string,
  ): Promise<ElementoPatrimonialDTO[]> {
    const propietarioId = !propietario || propietario === 'me' ? user.id : propietario;
    return this.elementos.listarPorPropietario(user.id, propietarioId);
  }

  @Get('elementos-patrimoniales/:id')
  obtener(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ElementoPatrimonialDTO> {
    return this.elementos.obtenerElemento(id, user.id);
  }

  @Get('elementos-patrimoniales/:id/impactos')
  impactos(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImpactoPatrimonialDTO[]> {
    return this.elementos.listarImpactos(id, user.id);
  }
}
