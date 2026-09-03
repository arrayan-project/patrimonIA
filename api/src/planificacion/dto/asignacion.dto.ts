import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CrearAsignacionDto {
  @IsString() @MinLength(1) nombre!: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoObjetivo?: number;
  @IsOptional() @IsUUID() objetivoId?: string;
}

export class ActualizarAsignacionDto {
  @IsUUID() asignacionId!: string;
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoObjetivo?: number;
}

export class CambiarAsociacionDto {
  @IsUUID() asignacionId!: string;
  /** null / omitido = desasociar. */
  @IsOptional() @ValidateIf((o) => o.objetivoId !== null) @IsUUID() objetivoId?: string | null;
}

export class EliminarAsignacionDto {
  @IsUUID() asignacionId!: string;
  @IsString() @MinLength(3) motivo!: string;
}
