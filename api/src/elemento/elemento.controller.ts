import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UsuarioAutenticado } from '../auth/jwt-payload.js';
import { RegistrarElementoDto } from './dto/registrar-elemento.dto.js';
import {
  ActualizarDatosElementoDto,
  CambiarParticipacionConsolidacionDto,
  CambiarPropiedadDto,
  CambiarVisibilidadDto,
  CorregirDatosElementoDto,
  DefinirVisibilidadDto,
  DesactivarElementoDto,
  EliminarElementoDto,
  LlevarPendienteACeroDto,
  ReactivarElementoDto,
} from './dto/comandos-elemento.dto.js';
import { ElementoService } from './elemento.service.js';
import type { ElementoPatrimonialDTO, ImpactoPatrimonialDTO } from './elemento.dto.js';

@Controller()
export class ElementoController {
  constructor(private readonly elementos: ElementoService) {}

  @Post('comandos/RegistrarElementoPatrimonial')
  registrar(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: RegistrarElementoDto,
  ): Promise<ElementoPatrimonialDTO> {
    return this.elementos.registrarElemento(user.id, dto);
  }

  @Post('comandos/ActualizarDatosElementoPatrimonial')
  @HttpCode(200)
  actualizarDatos(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ActualizarDatosElementoDto) {
    return this.elementos.actualizarDatos(u.id, dto);
  }

  @Post('comandos/CorregirDatosElementoPatrimonial')
  @HttpCode(200)
  corregirDatos(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CorregirDatosElementoDto) {
    return this.elementos.corregirDatos(u.id, dto);
  }

  @Post('comandos/CambiarVisibilidadElementoPatrimonial')
  @HttpCode(200)
  cambiarVisibilidad(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CambiarVisibilidadDto) {
    return this.elementos.cambiarVisibilidad(u.id, dto);
  }

  @Post('comandos/DefinirVisibilidadElementoPatrimonial')
  @HttpCode(200)
  definirVisibilidad(@CurrentUser() u: UsuarioAutenticado, @Body() dto: DefinirVisibilidadDto) {
    return this.elementos.definirVisibilidad(u.id, dto);
  }

  @Post('comandos/CambiarParticipacionEnConsolidacion')
  @HttpCode(200)
  cambiarParticipacion(
    @CurrentUser() u: UsuarioAutenticado,
    @Body() dto: CambiarParticipacionConsolidacionDto,
  ) {
    return this.elementos.cambiarParticipacionConsolidacion(u.id, dto);
  }

  @Post('comandos/DesactivarElementoPatrimonial')
  @HttpCode(200)
  desactivar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: DesactivarElementoDto) {
    return this.elementos.desactivar(u.id, dto);
  }

  @Post('comandos/ReactivarElementoPatrimonial')
  @HttpCode(200)
  reactivar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: ReactivarElementoDto) {
    return this.elementos.reactivar(u.id, dto);
  }

  @Post('comandos/EliminarElementoPatrimonial')
  @HttpCode(200)
  eliminar(@CurrentUser() u: UsuarioAutenticado, @Body() dto: EliminarElementoDto) {
    return this.elementos.eliminar(u.id, dto);
  }

  @Post('comandos/CambiarPropiedadElementoPatrimonial')
  @HttpCode(200)
  cambiarPropiedad(@CurrentUser() u: UsuarioAutenticado, @Body() dto: CambiarPropiedadDto) {
    return this.elementos.cambiarPropiedad(u.id, dto);
  }

  @Post('comandos/CondonarDeuda')
  @HttpCode(200)
  condonarDeuda(@CurrentUser() u: UsuarioAutenticado, @Body() dto: LlevarPendienteACeroDto) {
    return this.elementos.condonarDeuda(u.id, dto);
  }

  @Post('comandos/DeclararIncobrable')
  @HttpCode(200)
  declararIncobrable(@CurrentUser() u: UsuarioAutenticado, @Body() dto: LlevarPendienteACeroDto) {
    return this.elementos.declararIncobrable(u.id, dto);
  }

  @Get('elementos-patrimoniales')
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query('propietario') propietario?: string,
    @Query('incluirInactivos') incluirInactivos?: string,
    @Query('categoria') categoria?: string,
    @Query('alcance') alcance?: string,
  ): Promise<ElementoPatrimonialDTO[]> {
    if (alcance === 'hogar') {
      // §A8 — elementos de co-miembros cuya existencia el actor puede ver.
      return this.elementos.listarVisiblesDelHogar(user.id);
    }
    const propietarioId = !propietario || propietario === 'me' ? user.id : propietario;
    return this.elementos.listarPorPropietario(
      user.id,
      propietarioId,
      incluirInactivos === 'true',
      categoria,
    );
  }

  @Get('elementos-patrimoniales/:id')
  obtener(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ElementoPatrimonialDTO> {
    return this.elementos.obtenerElemento(id, user.id);
  }

  @Get('elementos-patrimoniales/:id/impactos')
  impactos(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImpactoPatrimonialDTO[]> {
    return this.elementos.listarImpactos(id, user.id);
  }
}
