import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarEventoDto } from './dto/registrar-evento.dto.js';
import { AnularEventoDto } from './dto/anular-evento.dto.js';
import { CorregirEventoDto } from './dto/corregir-evento.dto.js';
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

  @Post('comandos/AnularEventoFinanciero')
  @HttpCode(200)
  anular(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: AnularEventoDto,
  ): Promise<EventoFinancieroDTO> {
    return this.eventos.anularEvento(user.id, dto);
  }

  @Post('comandos/CorregirEventoFinanciero')
  corregir(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: CorregirEventoDto,
  ): Promise<EventoFinancieroDTO> {
    return this.eventos.corregirEvento(user.id, dto);
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
