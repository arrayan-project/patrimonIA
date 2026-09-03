import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarEventoDto } from './dto/registrar-evento.dto.js';
import { EventoFinancieroService } from './evento.service.js';
import type { EventoFinancieroDTO } from './evento.dto.js';

@Controller()
export class EventoFinancieroController {
  constructor(private readonly eventos: EventoFinancieroService) {}

  @Post('comandos/RegistrarEventoFinanciero')
  registrar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: RegistrarEventoDto,
  ): Promise<EventoFinancieroDTO> {
    return this.eventos.registrarEvento(user.id, dto);
  }

  @Get('eventos-financieros')
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('elemento') elemento?: string,
  ): Promise<EventoFinancieroDTO[]> {
    if (!elemento) {
      throw new BadRequestException('Falta el parámetro ?elemento=<id>');
    }
    return this.eventos.listarPorElemento(elemento, user.id);
  }

  @Get('eventos-financieros/:id')
  obtener(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventoFinancieroDTO> {
    return this.eventos.obtenerEvento(id, user.id);
  }
}
