import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CATEGORIAS_SUGERIDAS = [
  'LIQUIDEZ',
  'RESERVA',
  'INVERSION',
  'ACTIVO',
  'DEUDA',
  'CREDITO',
] as const;

export class CrearTipoElementoDto {
  @IsUUID()
  hogarId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre!: string;

  @IsOptional()
  @IsIn(CATEGORIAS_SUGERIDAS)
  categoriaSugerida?: (typeof CATEGORIAS_SUGERIDAS)[number];
}

export class ActualizarTipoElementoDto {
  @IsUUID()
  tipoId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre?: string;

  /** Valor válido para fijarla; null para quitarla. */
  @IsOptional()
  @IsIn([...CATEGORIAS_SUGERIDAS, null])
  categoriaSugerida?: (typeof CATEGORIAS_SUGERIDAS)[number] | null;
}

export class ArchivarTipoElementoDto {
  @IsUUID()
  tipoId!: string;
}

export class ReordenarTiposElementoDto {
  @IsUUID()
  hogarId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orden!: string[];
}
