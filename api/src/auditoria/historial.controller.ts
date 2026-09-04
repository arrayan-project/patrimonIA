import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { HistorialService, type EntradaHistorialDTO } from './historial.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}

  @Get('historial')
  listar(
    @CurrentUser() u: UsuarioAutenticado,
    @Query('entidadTipo') entidadTipo?: string,
    @Query('entidadId') entidadId?: string,
  ): Promise<EntradaHistorialDTO[]> {
    if (!entidadTipo) throw new BadRequestException('Falta ?entidadTipo=');
    if (!entidadId || !UUID.test(entidadId)) throw new BadRequestException('Falta ?entidadId= (UUID)');
    return this.historial.listar(u.id, entidadTipo, entidadId);
  }
}
