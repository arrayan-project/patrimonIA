import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { CrearHogarDto } from './dto/crear-hogar.dto.js';
import { InvitarMiembroDto } from './dto/invitar-miembro.dto.js';
import { InvitacionIdDto } from './dto/invitacion-id.dto.js';
import {
  ActualizarDatosHogarDto,
  AsignarRolDto,
  CambiarInicioMesHogarDto,
  CambiarMonedaConsolidacionDto,
  EliminarHogarDto,
  RemoverMiembroDto,
  SalirDeHogarDto,
} from './dto/comandos-hogar.dto.js';
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

  @Post('comandos/ActualizarDatosHogar')
  @HttpCode(200)
  actualizarDatosHogar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarDatosHogarDto) {
    return this.hogares.actualizarDatosHogar(u.id, dto.hogarId, dto.nombre);
  }

  @Post('comandos/CambiarMonedaConsolidacion')
  @HttpCode(200)
  cambiarMoneda(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CambiarMonedaConsolidacionDto) {
    return this.hogares.cambiarMonedaConsolidacion(u.id, dto.hogarId, dto.moneda);
  }

  @Post('comandos/CambiarInicioMesHogar')
  @HttpCode(200)
  cambiarInicioMes(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CambiarInicioMesHogarDto) {
    return this.hogares.cambiarInicioMes(u.id, dto.hogarId, dto.dia);
  }

  @Post('comandos/AsignarRol')
  @HttpCode(200)
  asignarRol(@CurrentUser() u: UsuarioAutenticado, @Body() dto: AsignarRolDto) {
    return this.hogares.asignarRol(u.id, dto.hogarId, dto.usuarioId, dto.rol);
  }

  @Post('comandos/RemoverMiembro')
  @HttpCode(200)
  removerMiembro(@CurrentUser() u: UsuarioAutenticado, @Body() dto: RemoverMiembroDto) {
    return this.hogares.removerMiembro(u.id, dto.hogarId, dto.usuarioId, dto.motivo);
  }

  @Post('comandos/SalirDeHogar')
  @HttpCode(200)
  salirDeHogar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: SalirDeHogarDto) {
    return this.hogares.salirDeHogar(u.id, dto.hogarId);
  }

  @Post('comandos/EliminarHogar')
  @HttpCode(200)
  eliminarHogar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarHogarDto) {
    return this.hogares.eliminarHogar(u.id, dto.hogarId, dto.motivo);
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
