import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import {
  AvisarTransferenciaSinAnotarDto,
  PagarSolicitudDto,
  RechazarSolicitudDto,
  RegistrarGastoCompartidoDto,
} from './dto/solicitud.dto.js';
import {
  SolicitudService,
  type ResultadoGastoCompartidoDTO,
  type SolicitudDTO,
  type TransferenciaHogarDTO,
} from './solicitud.service.js';

@Controller()
export class SolicitudController {
  constructor(private readonly solicitudes: SolicitudService) {}

  /** D-7 — Gasté → Compartido con el hogar: el gasto por el total y una solicitud por cada parte. */
  @Post('comandos/RegistrarGastoCompartido')
  registrarGastoCompartido(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: RegistrarGastoCompartidoDto,
  ): Promise<ResultadoGastoCompartidoDTO> {
    return this.solicitudes.registrarGastoCompartido(u.id, dto);
  }

  /** Recibí → De alguien del hogar: "Avisarle a [miembro]" que anote la transferencia. */
  @Post('comandos/AvisarTransferenciaSinAnotar')
  avisar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: AvisarTransferenciaSinAnotarDto): Promise<SolicitudDTO> {
    return this.solicitudes.avisarSinAnotar(u.id, dto);
  }

  /** El destinatario anota la transferencia que salda la solicitud. */
  @Post('comandos/PagarSolicitud')
  @HttpCode(200)
  pagar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: PagarSolicitudDto): Promise<SolicitudDTO> {
    return this.solicitudes.pagar(u.id, dto);
  }

  /** "No me corresponde". */
  @Post('comandos/RechazarSolicitud')
  @HttpCode(200)
  rechazar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: RechazarSolicitudDto): Promise<SolicitudDTO> {
    return this.solicitudes.rechazar(u.id, dto);
  }

  /** HZ-21 — "Entre [miembro] y tú": las solicitudes en las dos direcciones. */
  @Get('usuarios/me/solicitudes')
  listar(@CurrentUser() u: UsuarioAutenticado): Promise<SolicitudDTO[]> {
    return this.solicitudes.listar(u.id);
  }

  /** HZ-21 y Recibí → De alguien del hogar: transferencias entre tus cuentas y las de otros miembros. */
  @Get('usuarios/me/transferencias-hogar')
  transferencias(
    @CurrentUser() u: UsuarioAutenticado,
    @Query('dias', new DefaultValuePipe(30), ParseIntPipe) dias: number,
  ): Promise<TransferenciaHogarDTO[]> {
    return this.solicitudes.transferenciasHogar(u.id, Math.min(Math.max(dias, 1), 366));
  }
}
