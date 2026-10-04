import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarPlataDeOtraPersonaDto } from './dto/registrar-plata.dto.js';
import {
  OtraPersonaService,
  type PersonaDTO,
  type ResultadoPlataDeOtraPersonaDTO,
} from './otra-persona.service.js';

@Controller()
export class OtraPersonaController {
  constructor(private readonly otraPersona: OtraPersonaService) {}

  /** D-3 / D-8 — entra o sale plata de una persona: mueve el saldo con ella, en una transacción. */
  @Post('comandos/RegistrarPlataDeOtraPersona')
  registrar(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: RegistrarPlataDeOtraPersonaDto,
  ): Promise<ResultadoPlataDeOtraPersonaDTO> {
    return this.otraPersona.registrar(u.id, dto);
  }

  /** Saldos con personas ("¿Quién?" en Gasté y Recibí). `?todas=true` incluye los que están en 0. */
  @Get('usuarios/me/personas')
  personas(@CurrentUser() u: UsuarioAutenticado, @Query('todas') todas?: string): Promise<PersonaDTO[]> {
    return this.otraPersona.personas(u.id, todas === 'true');
  }
}
