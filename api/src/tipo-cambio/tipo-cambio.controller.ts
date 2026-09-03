import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { TipoCambioService } from './tipo-cambio.service.js';
import { RegistrarTipoCambioDto } from './dto/tipo-cambio.dto.js';

@Controller()
export class TipoCambioController {
  constructor(private readonly tiposCambio: TipoCambioService) {}

  @Post('comandos/RegistrarTipoCambio')
  registrar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: RegistrarTipoCambioDto) {
    return this.tiposCambio.registrar(u.id, dto);
  }

  @Get('tipos-cambio')
  listar(@Query('origen') origen?: string, @Query('destino') destino?: string) {
    return this.tiposCambio.listar(origen, destino);
  }
}
