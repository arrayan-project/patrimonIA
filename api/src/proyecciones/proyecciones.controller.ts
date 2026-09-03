import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { ProyeccionesService, type PatrimonioIndividualDTO } from './proyecciones.service.js';

@Controller()
export class ProyeccionesController {
  constructor(private readonly proyecciones: ProyeccionesService) {}

  @Get('usuarios/me/patrimonio-individual')
  patrimonioIndividual(
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PatrimonioIndividualDTO> {
    return this.proyecciones.patrimonioIndividual(user.id);
  }
}
