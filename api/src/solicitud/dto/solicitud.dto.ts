import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Lo que le toca a un miembro del hogar en un gasto compartido. */
export class ParteDto {
  @IsUUID() usuarioId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto!: number;
}

/**
 * D-7 (M7) — RegistrarGastoCompartido: el gasto por el total, hecho por quien
 * pagó, y una solicitud a cada miembro por su parte. Los campos del gasto son
 * los de RegistrarEventoFinanciero (GASTO).
 */
export class RegistrarGastoCompartidoDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto!: number;

  @Length(3, 3) moneda!: string;

  @IsOptional() @IsISO8601() fecha?: string;

  @IsUUID() elementoOrigenId!: string;

  @IsOptional() @IsUUID() asignacionId?: string;

  @IsOptional() @IsUUID() categoriaId?: string;

  @IsOptional() @IsString() @MaxLength(140) glosa?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  etiquetaIds?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ParteDto)
  partes!: ParteDto[];

  /** Cuenta propia donde quien pagó recibe las partes. */
  @IsUUID() cuentaDestinoId!: string;
}

/** Recibí → De alguien del hogar: "Avisarle a [miembro]" que anote la transferencia. */
export class AvisarTransferenciaSinAnotarDto {
  @IsUUID() usuarioId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto!: number;

  /** Cuenta propia donde llegó la plata. */
  @IsUUID() cuentaDestinoId!: string;

  @IsOptional() @IsISO8601() fecha?: string;
}

/** El destinatario anota la TRANSFERENCIA que salda la solicitud. */
export class PagarSolicitudDto {
  @IsUUID() solicitudId!: string;

  @IsUUID() elementoOrigenId!: string;

  @IsOptional() @IsISO8601() fecha?: string;
}

/** "No me corresponde". */
export class RechazarSolicitudDto {
  @IsUUID() solicitudId!: string;
}
