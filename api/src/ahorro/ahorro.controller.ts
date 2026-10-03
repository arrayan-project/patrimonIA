import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { AhorrarParaObjetivoDto } from './dto/ahorrar.dto.js';
import { AhorroService, type ResultadoAhorroDTO } from './ahorro.service.js';

@Controller()
export class AhorroController {
  constructor(private readonly ahorro: AhorroService) {}

  /** D-1 — transfiere desde N cuentas a la de la meta y lo deja ahorrado, en una transacción. */
  @Post('comandos/AhorrarParaObjetivo')
  ahorrar(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: AhorrarParaObjetivoDto,
  ): Promise<ResultadoAhorroDTO> {
    return this.ahorro.ahorrar(u.id, dto);
  }

  /** Lo libre para ahorrar de cada cuenta propia (pantalla "Ahorrar"). */
  @Get('usuarios/me/disponibilidad')
  disponibilidad(@CurrentUser() u: UsuarioAutenticado) {
    return this.ahorro.disponibilidades(u.id);
  }
}
