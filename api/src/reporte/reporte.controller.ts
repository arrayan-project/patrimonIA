import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { ReporteService } from './reporte.service.js';
import type { AlcanceReporte } from './reporte.dto.js';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function alcanceDe(v: string | undefined): AlcanceReporte {
  if (v === 'hogar') return 'hogar';
  if (v === 'mios' || v === undefined) return 'mios';
  throw new BadRequestException('alcance debe ser "mios" o "hogar"');
}

@Controller()
export class ReporteController {
  constructor(private readonly reporte: ReporteService) {}

  @Get('usuarios/me/resumen-financiero')
  resumen(
    @CurrentUser() u: UsuarioAutenticado,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('alcance') alcance?: string,
    @Query('hogarId') hogarId?: string,
  ) {
    if (!desde || !FECHA_ISO.test(desde)) throw new BadRequestException('Falta ?desde=YYYY-MM-DD');
    if (!hasta || !FECHA_ISO.test(hasta)) throw new BadRequestException('Falta ?hasta=YYYY-MM-DD');
    return this.reporte.resumenPeriodo(u.id, desde, hasta, alcanceDe(alcance), hogarId);
  }

  @Get('usuarios/me/resumen-anual')
  anual(
    @CurrentUser() u: UsuarioAutenticado,
    @Query('anio') anio?: string,
    @Query('alcance') alcance?: string,
    @Query('hogarId') hogarId?: string,
  ) {
    const n = Number(anio);
    if (!Number.isInteger(n)) throw new BadRequestException('Falta ?anio=YYYY');
    return this.reporte.resumenAnual(u.id, n, alcanceDe(alcance), hogarId);
  }
}
