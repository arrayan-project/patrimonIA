import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { CrearHogarDto } from './dto/crear-hogar.dto.js';
import { InvitarMiembroDto } from './dto/invitar-miembro.dto.js';
import { InvitacionIdDto } from './dto/invitacion-id.dto.js';
import { HogarService } from './hogar.service.js';
import type { HogarDTO, InvitacionDTO, MembresiaDTO, MiembroDTO } from './hogar.dto.js';

/**
 * Mutaciones: POST /comandos/{NombreComando} (mapeo 1:1 con Application
 * Services). Consultas: REST clásico. Nombres de comando literales — sin
 * traducir a CRUD (BUILD_INSTRUCTIONS §5).
 */
@Controller()
export class HogarController {
  constructor(private readonly hogares: HogarService) {}

  // ── Comandos ──────────────────────────────────────────────────────────────

  @Post('comandos/CrearHogar')
  crearHogar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: CrearHogarDto,
  ): Promise<HogarDTO> {
    return this.hogares.crearHogar({
      creadorId: user.id,
      nombre: dto.nombre,
      monedaConsolidacion: dto.monedaConsolidacion,
    });
  }

  @Post('comandos/InvitarMiembro')
  invitarMiembro(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: InvitarMiembroDto,
  ): Promise<InvitacionDTO> {
    return this.hogares.invitarMiembro({
      emisorId: user.id,
      hogarId: dto.hogarId,
      emailInvitado: dto.emailInvitado,
    });
  }

  @Post('comandos/AceptarInvitacion')
  @HttpCode(200)
  aceptarInvitacion(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: InvitacionIdDto,
  ): Promise<MembresiaDTO> {
    return this.hogares.aceptarInvitacion({
      usuarioId: user.id,
      invitacionId: dto.invitacionId,
    });
  }

  @Post('comandos/RechazarInvitacion')
  @HttpCode(200)
  rechazarInvitacion(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: InvitacionIdDto,
  ): Promise<{ ok: true }> {
    return this.hogares.rechazarInvitacion({
      usuarioId: user.id,
      invitacionId: dto.invitacionId,
    });
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  @Get('usuarios/me/hogares')
  hogaresDeUsuario(@CurrentUser() user: UsuarioAutenticado): Promise<HogarDTO[]> {
    return this.hogares.listarHogaresDeUsuario(user.id);
  }

  @Get('usuarios/me/invitaciones')
  invitacionesRecibidas(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('estado') estado?: string,
  ): Promise<InvitacionDTO[]> {
    return this.hogares.listarInvitacionesRecibidas(user.id, estado);
  }

  @Get('hogares/:id')
  obtenerHogar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<HogarDTO> {
    return this.hogares.obtenerHogar(id, user.id);
  }

  @Get('hogares/:id/miembros')
  miembros(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MiembroDTO[]> {
    return this.hogares.listarMiembros(id, user.id);
  }

  @Get('hogares/:id/invitaciones')
  invitacionesHogar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('estado') estado?: string,
  ): Promise<InvitacionDTO[]> {
    return this.hogares.listarInvitacionesHogar(id, user.id, estado);
  }
}
