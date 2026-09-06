import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export const ESTADOS_OBJETIVO = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;

export class CrearObjetivoDto {
  @IsString() @MinLength(1) nombre!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoObjetivo!: number;
  @IsOptional() @IsISO8601() fechaObjetivo?: string;
  /** P9 — compartir con un hogar del actor (se vuelve visible para sus miembros). */
  @IsOptional() @IsUUID() hogarId?: string;
  /** P11 — etiqueta de moneda (sin conversión). Por defecto CLP. */
  @IsOptional() @IsString() @MinLength(3) moneda?: string;
}

/** P9 — CompartirObjetivoConHogar. Solo el dueño. hogarId null → dejar de compartir. */
export class CompartirObjetivoConHogarDto {
  @IsUUID() objetivoId!: string;
  @IsOptional() @IsUUID() hogarId?: string | null;
}

/** P9 — DefinirDesignadosObjetivo. Solo el ADMINISTRADOR del hogar (o el dueño). */
export class DefinirDesignadosObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsArray() @ArrayMaxSize(50) @IsUUID('4', { each: true }) usuarioIds!: string[];
}

export class ActualizarObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() montoObjetivo?: number;
  @IsOptional() @IsISO8601() fechaObjetivo?: string;
  @IsOptional() @IsString() @MinLength(3) moneda?: string;
}

export class CambiarEstadoObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsIn(ESTADOS_OBJETIVO) estado!: (typeof ESTADOS_OBJETIVO)[number];
}

export class EliminarObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsString() @MinLength(3) motivo!: string;
}
