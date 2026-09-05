import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DetalleDeudaDto, PropietarioDto, VISIBILIDADES } from './registrar-elemento.dto.js';

export class ActualizarDatosElementoDto extends DetalleDeudaDto {
  @IsUUID() elementoId!: string;
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsString() @MinLength(1) tipo?: string;
}

export class CorregirDatosElementoDto extends ActualizarDatosElementoDto {
  @IsString() @MinLength(3) motivo!: string;
}

export class CambiarVisibilidadDto {
  @IsUUID() elementoId!: string;
  @IsIn(VISIBILIDADES) visibilidad!: (typeof VISIBILIDADES)[number];
}

export const TIPOS_INFO_ELEMENTO = ['EXISTENCIA', 'VALOR', 'MOVIMIENTOS'] as const;

class NivelPorTipoDto {
  @IsOptional() @IsIn(VISIBILIDADES) EXISTENCIA?: (typeof VISIBILIDADES)[number];
  @IsOptional() @IsIn(VISIBILIDADES) VALOR?: (typeof VISIBILIDADES)[number];
  @IsOptional() @IsIn(VISIBILIDADES) MOVIMIENTOS?: (typeof VISIBILIDADES)[number];
}

/**
 * §B1 — visibilidad granular. `niveles` sobrescribe el nivel por tipo de
 * información (ausente = usar el nivel base `visibilidad`). `compartidoCon` es la
 * lista de usuarios con los que se comparte cuando algún nivel es COMPARTIDA
 * (FAMILIAR = todos los co-miembros; PRIVADA = nadie).
 */
export class DefinirVisibilidadDto {
  @IsUUID() elementoId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NivelPorTipoDto)
  niveles?: NivelPorTipoDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compartidoCon?: string[];
}

export class CambiarParticipacionConsolidacionDto {
  @IsUUID() elementoId!: string;
  @IsBoolean() participa!: boolean;
}

export class DesactivarElementoDto {
  @IsUUID() elementoId!: string;
  @IsOptional() @IsString() motivo?: string;
}

export class ReactivarElementoDto {
  @IsUUID() elementoId!: string;
  @IsString() @MinLength(3) motivo!: string;
}

export class EliminarElementoDto {
  @IsUUID() elementoId!: string;
  @IsString() @MinLength(3) justificacion!: string;
}

export class CambiarPropiedadDto {
  @IsUUID() elementoId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PropietarioDto)
  propietarios!: PropietarioDto[];
}

/** Body de POST /comandos/CondonarDeuda (AS #47) y /comandos/DeclararIncobrable (AS #48). */
export class LlevarPendienteACeroDto {
  @IsUUID() elementoId!: string;
  @IsString() @MinLength(3) motivo!: string;
}
