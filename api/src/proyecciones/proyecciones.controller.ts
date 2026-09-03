import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { ProyeccionesService, type PatrimonioIndividualDTO } from './proyecciones.service.js';
import {
  ReconstruccionService,
  type PatrimonioHistoricoDTO,
  type ValorHistoricoElementoDTO,
  type VariacionPatrimonialDTO,
} from './reconstruccion.service.js';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function exigirFecha(valor: string | undefined, nombre: string): string {
  if (!valor || !FECHA_ISO.test(valor)) {
    throw new BadRequestException(`Falta el parámetro ?${nombre}=YYYY-MM-DD`);
  }
  return valor;
}

@Controller()
export class ProyeccionesController {
  constructor(
    private readonly proyecciones: ProyeccionesService,
    private readonly reconstruccion: ReconstruccionService,
  ) {}

  @Get('usuarios/me/patrimonio-individual')
  patrimonioIndividual(
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PatrimonioIndividualDTO> {
    return this.proyecciones.patrimonioIndividual(user.id);
  }

  @Get('usuarios/me/patrimonio-individual/historico')
  patrimonioHistorico(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('fecha') fecha?: string,
  ): Promise<PatrimonioHistoricoDTO> {
    return this.reconstruccion.patrimonioIndividualHistorico(
      user.id,
      exigirFecha(fecha, 'fecha'),
    );
  }

  @Get('usuarios/me/variacion-patrimonial')
  variacionPatrimonial(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ): Promise<VariacionPatrimonialDTO> {
    return this.reconstruccion.variacionPatrimonial(
      user.id,
      exigirFecha(desde, 'desde'),
      hasta && FECHA_ISO.test(hasta) ? hasta : undefined,
    );
  }

  @Get('elementos-patrimoniales/:id/valor-historico')
  valorHistoricoElemento(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fecha') fecha?: string,
  ): Promise<ValorHistoricoElementoDTO> {
    return this.reconstruccion.valorHistoricoElemento(id, user.id, exigirFecha(fecha, 'fecha'));
  }
}
