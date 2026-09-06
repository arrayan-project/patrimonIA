import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { ObjetivoService } from './objetivo.service.js';
import { AsignacionService } from './asignacion.service.js';
import { ReservaService } from './reserva.service.js';
import {
  ActualizarObjetivoDto,
  CambiarEstadoObjetivoDto,
  CompartirObjetivoConHogarDto,
  CrearObjetivoDto,
  DefinirDesignadosObjetivoDto,
  EliminarObjetivoDto,
} from './dto/objetivo.dto.js';
import {
  ActualizarAsignacionDto,
  CambiarAsociacionDto,
  CrearAsignacionDto,
  EliminarAsignacionDto,
} from './dto/asignacion.dto.js';
import { AjustarMontoReservaDto, CrearReservaDto, LiberarReservaDto } from './dto/reserva.dto.js';

@Controller()
export class PlanificacionController {
  constructor(
    private readonly objetivos: ObjetivoService,
    private readonly asignaciones: AsignacionService,
    private readonly reservas: ReservaService,
  ) {}

  // ── Objetivo Financiero ──────────────────────────────────────────────────

  @Post('comandos/CrearObjetivoFinanciero')
  crearObjetivo(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearObjetivoDto) {
    return this.objetivos.crear(u.id, dto);
  }

  @Post('comandos/ActualizarDatosObjetivoFinanciero')
  @HttpCode(200)
  actualizarObjetivo(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarObjetivoDto) {
    return this.objetivos.actualizar(u.id, dto);
  }

  @Post('comandos/CambiarEstadoObjetivoFinanciero')
  @HttpCode(200)
  cambiarEstadoObjetivo(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CambiarEstadoObjetivoDto) {
    return this.objetivos.cambiarEstado(u.id, dto);
  }

  @Post('comandos/EliminarObjetivoFinanciero')
  @HttpCode(200)
  eliminarObjetivo(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarObjetivoDto) {
    return this.objetivos.eliminar(u.id, dto);
  }

  @Post('comandos/CompartirObjetivoConHogar')
  @HttpCode(200)
  compartirObjetivo(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: CompartirObjetivoConHogarDto,
  ) {
    return this.objetivos.compartirConHogar(u.id, dto);
  }

  @Post('comandos/DefinirDesignadosObjetivo')
  @HttpCode(200)
  definirDesignados(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: DefinirDesignadosObjetivoDto,
  ) {
    return this.objetivos.definirDesignados(u.id, dto);
  }

  @Get('objetivos-financieros')
  listarObjetivos(@CurrentUser() u: UsuarioAutenticado, @Query('estado') estado?: string) {
    return this.objetivos.listar(u.id, estado);
  }

  @Get('objetivos-financieros/:id')
  obtenerObjetivo(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.objetivos.obtener(id, u.id);
  }

  // ── Asignación ───────────────────────────────────────────────────────────

  @Post('comandos/CrearAsignacion')
  crearAsignacion(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearAsignacionDto) {
    return this.asignaciones.crear(u.id, dto);
  }

  @Post('comandos/ActualizarDatosAsignacion')
  @HttpCode(200)
  actualizarAsignacion(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarAsignacionDto) {
    return this.asignaciones.actualizar(u.id, dto);
  }

  @Post('comandos/CambiarAsociacionAObjetivo')
  @HttpCode(200)
  cambiarAsociacion(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CambiarAsociacionDto) {
    return this.asignaciones.cambiarAsociacion(u.id, dto);
  }

  @Post('comandos/EliminarAsignacion')
  @HttpCode(200)
  eliminarAsignacion(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarAsignacionDto) {
    return this.asignaciones.eliminar(u.id, dto);
  }

  @Get('asignaciones')
  listarAsignaciones(@CurrentUser() u: UsuarioAutenticado, @Query('objetivo') objetivo?: string) {
    return this.asignaciones.listar(u.id, objetivo);
  }

  @Get('asignaciones/:id')
  obtenerAsignacion(@CurrentUser() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.asignaciones.obtener(id, u.id);
  }

  @Get('asignaciones/:id/reservas')
  reservasDeAsignacion(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservas.listarPorAsignacion(id, u.id);
  }

  @Get('elementos-patrimoniales/:id/reservas')
  reservasDeElemento(
    @CurrentUser() u: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservas.listarPorElementoOrigen(id, u.id);
  }

  // ── Reserva ──────────────────────────────────────────────────────────────

  @Post('comandos/CrearReserva')
  crearReserva(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CrearReservaDto) {
    return this.reservas.crear(u.id, dto);
  }

  @Post('comandos/AjustarMontoReserva')
  @HttpCode(200)
  ajustarReserva(@CurrentUser() u: UsuarioAutenticado, @Body() dto: AjustarMontoReservaDto) {
    return this.reservas.ajustarMonto(u.id, dto);
  }

  @Post('comandos/LiberarReserva')
  @HttpCode(200)
  liberarReserva(@CurrentUser() u: UsuarioAutenticado, @Body() dto: LiberarReservaDto) {
    return this.reservas.liberar(u.id, dto);
  }
}
