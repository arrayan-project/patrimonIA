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
