import { IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export const ESTADOS_OBJETIVO = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;

export class CrearObjetivoDto {
  @IsString() @MinLength(1) nombre!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoObjetivo!: number;
  @IsOptional() @IsISO8601() fechaObjetivo?: string;
}

export class ActualizarObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoObjetivo?: number;
  @IsOptional() @IsISO8601() fechaObjetivo?: string;
}

export class CambiarEstadoObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsIn(ESTADOS_OBJETIVO) estado!: (typeof ESTADOS_OBJETIVO)[number];
}

export class EliminarObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsString() @MinLength(3) motivo!: string;
}
