import { Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { Public } from '../auth/public.decorator.js';
import { RegistrarUsuarioDto } from './dto/registrar-usuario.dto.js';
import {
  ActualizarDatosUsuarioDto,
  DesactivarUsuarioDto,
} from './dto/comandos-usuario.dto.js';
import { UsuarioService } from './usuario.service.js';
import type { UsuarioDTO } from './usuario.dto.js';

@Controller()
export class UsuarioController {
  constructor(private readonly usuarios: UsuarioService) {}

  /**
   * API_DESIGN pide un "token de sesión temporal de registro" para este
   * endpoint. Ese pre-registro no está modelado en el dominio (no hay comando
   * para emitirlo) — decisión técnica: se difiere y el endpoint queda @Public.
   * Ver GAPS.md.
   */
  @Public()
  @Post('comandos/RegistrarUsuario')
  registrarUsuario(@Body() dto: RegistrarUsuarioDto): Promise<UsuarioDTO> {
    return this.usuarios.registrarUsuario(dto);
  }

  @Get('usuarios/me')
  async me(@CurrentUser() user: UsuarioAutenticado): Promise<UsuarioDTO> {
    const usuario = await this.usuarios.obtenerPorId(user.id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  @Post('comandos/ActualizarDatosUsuario')
  @HttpCode(200)
  actualizarDatos(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: ActualizarDatosUsuarioDto,
  ): Promise<UsuarioDTO> {
    return this.usuarios.actualizarDatos(user.id, dto);
  }

  @Post('comandos/DesactivarUsuario')
  @HttpCode(200)
  desactivar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: DesactivarUsuarioDto,
  ): Promise<{ ok: true }> {
    return this.usuarios.desactivar(user.id, dto);
  }
}
