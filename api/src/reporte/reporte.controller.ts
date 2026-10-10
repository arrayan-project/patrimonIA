import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { ReporteService } from './reporte.service.js';
import type { AlcanceReporte } from './reporte.dto.js';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** G42: `?cuentas=id,id` — las cuentas del día a día. Ausente = todas las tuyas. */
function cuentasDe(v: string | undefined): string[] | undefined {
  if (v === undefined) return undefined;
  const ids = v.split(',').map((x) => x.trim()).filter(Boolean);
  if (ids.some((x) => !UUID.test(x))) throw new BadRequestException('cuentas debe ser una lista de ids');
  return ids;
}

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
    @Query('cuentas') cuentas?: string,
  ) {
    if (!desde || !FECHA_ISO.test(desde)) throw new BadRequestException('Falta ?desde=YYYY-MM-DD');
    if (!hasta || !FECHA_ISO.test(hasta)) throw new BadRequestException('Falta ?hasta=YYYY-MM-DD');
    return this.reporte.resumenPeriodo(u.id, desde, hasta, alcanceDe(alcance), hogarId, cuentasDe(cuentas));
  }

  /** G41 — la foto del mes de tus cuentas del día a día (G42). */
  @Get('usuarios/me/foto-mes')
  fotoMes(
    @CurrentUser() u: UsuarioAutenticado,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('cuentas') cuentas?: string,
  ) {
    if (!desde || !FECHA_ISO.test(desde)) throw new BadRequestException('Falta ?desde=YYYY-MM-DD');
    if (!hasta || !FECHA_ISO.test(hasta)) throw new BadRequestException('Falta ?hasta=YYYY-MM-DD');
    return this.reporte.fotoMes(u.id, desde, hasta, cuentasDe(cuentas));
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
