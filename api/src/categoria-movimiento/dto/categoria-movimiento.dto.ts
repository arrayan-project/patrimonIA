import {
  ArrayNotEmpty,
  IsArray,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TIPOS_APLICABLE = ['INGRESO', 'GASTO', 'AMBOS'] as const;

export class CrearCategoriaMovimientoDto {
  @IsUUID()
  hogarId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre!: string;

  @IsIn(TIPOS_APLICABLE)
  tipoAplicable!: (typeof TIPOS_APLICABLE)[number];

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icono?: string;
}

export class ActualizarCategoriaMovimientoDto {
  @IsUUID()
  categoriaId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre?: string;

  @IsOptional()
  @IsIn(TIPOS_APLICABLE)
  tipoAplicable?: (typeof TIPOS_APLICABLE)[number];

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icono?: string;
}

export class ArchivarCategoriaMovimientoDto {
  @IsUUID()
  categoriaId!: string;
}

export class ReordenarCategoriasMovimientoDto {
  @IsUUID()
  hogarId!: string;

  /** Ids de las categorías del hogar en el orden deseado. */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orden!: string[];
}
