import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { ConsolidacionService } from './consolidacion.service.js';

@Controller()
export class ConsolidacionController {
  constructor(private readonly consolidacion: ConsolidacionService) {}

  @Get('hogares/:id/patrimonio-consolidado')
  patrimonioConsolidado(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consolidacion.patrimonioConsolidado(id, u.id);
  }

  @Get('hogares/:id/elementos')
  elementosDelHogar(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.consolidacion.elementosDelHogar(id, u.id);
  }

  @Get('hogares/:id/metricas')
  metricas(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.consolidacion.metricas(id, u.id);
  }

  @Get('hogares/:id/eventos-financieros')
  eventosDelHogar(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consolidacion.eventosDelHogar(id, u.id);
  }
}
