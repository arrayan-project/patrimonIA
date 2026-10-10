import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { TipoCambioService } from './tipo-cambio.service.js';
import { ConversionService } from './conversion.service.js';
import { RegistrarTipoCambioDto } from './dto/tipo-cambio.dto.js';

@Controller()
export class TipoCambioController {
  constructor(
    private readonly tiposCambio: TipoCambioService,
    private readonly conversion: ConversionService,
  ) {}

  @Post('comandos/RegistrarTipoCambio')
  registrar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: RegistrarTipoCambioDto) {
    return this.tiposCambio.registrar(u.id, dto);
  }

  /**
   * G39 (M11): la tasa que usaría una CONVERSION origen→destino a esa fecha
   * (directa, inversa o triangulada por CLP); null si no hay. Solo lectura.
   */
  @Get('tipos-cambio/tasa')
  async tasa(
    @Query('origen') origen: string,
    @Query('destino') destino: string,
    @Query('fecha') fecha?: string,
  ): Promise<{ tasa: number | null }> {
    if (!origen || !destino) throw new BadRequestException('origen y destino son obligatorios');
    const dia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(fecha) : new Date();
    try {
      const t = await this.conversion.tasa(origen.toUpperCase(), destino.toUpperCase(), dia);
      return { tasa: t.toNumber() };
    } catch {
      return { tasa: null };
    }
  }

  @Get('tipos-cambio')
  listar(@Query('origen') origen?: string, @Query('destino') destino?: string) {
    return this.tiposCambio.listar(origen, destino);
  }
}
