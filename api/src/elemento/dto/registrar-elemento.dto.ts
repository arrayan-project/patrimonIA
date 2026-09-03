import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Fase 2 (Flujo 1) trabaja categorías de activo. DEUDA/CREDITO es un ciclo
 * vertical aparte (Flujo 4) y arrastra el vacío G1 — ver GAPS.md.
 */
export const CATEGORIAS_FASE_2 = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO'] as const;
export const VISIBILIDADES = ['PRIVADA', 'COMPARTIDA', 'FAMILIAR'] as const;
export const AMBITOS = ['PERSONAL', 'HOGAR'] as const;

export class PropietarioDto {
  @IsUUID()
  usuarioId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  porcentaje!: number;
}

export class RegistrarElementoDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsString()
  @MinLength(1)
  tipo!: string;

  @IsIn(CATEGORIAS_FASE_2)
  categoriaFuncional!: (typeof CATEGORIAS_FASE_2)[number];

  @IsOptional()
  @IsIn(AMBITOS)
  ambito?: (typeof AMBITOS)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorInicial!: number;

  @IsString()
  @Length(3, 3)
  moneda!: string;

  @IsOptional()
  @IsBoolean()
  participaValorLiquido?: boolean;

  @IsOptional()
  @IsBoolean()
  participaConsolidacion?: boolean;

  @IsOptional()
  @IsBoolean()
  admiteValorizacion?: boolean;

  @IsOptional()
  @IsIn(VISIBILIDADES)
  visibilidad?: (typeof VISIBILIDADES)[number];

  /** Si se omite: [{ usuarioId: <actor>, porcentaje: 100 }]. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PropietarioDto)
  propietarios?: PropietarioDto[];
}
