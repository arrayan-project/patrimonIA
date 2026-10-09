import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export const TIPOS_PLANTILLA = ['INGRESO', 'GASTO', 'TRANSFERENCIA'] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

/** Body de POST /comandos/CrearPlantillaMovimiento (GAPS.md G24). */
export class CrearPlantillaMovimientoDto {
  @IsString()
  @Length(1, 40)
  nombre!: string;

  @IsIn(TIPOS_PLANTILLA)
  tipo!: TipoPlantilla;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string;

  @IsOptional()
  @IsUUID()
  elementoOrigenId?: string;

  @IsOptional()
  @IsUUID()
  elementoDestinoId?: string;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  glosa?: string;
}

/** Body de POST /comandos/ActualizarPlantillaMovimiento. `null` limpia un campo opcional. */
export class ActualizarPlantillaMovimientoDto {
  @IsUUID()
  plantillaId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  nombre?: string;

  @IsOptional()
  @IsIn(TIPOS_PLANTILLA)
  tipo?: TipoPlantilla;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number | null;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  moneda?: string | null;

  @IsOptional()
  @IsUUID()
  elementoOrigenId?: string | null;

  @IsOptional()
  @IsUUID()
  elementoDestinoId?: string | null;

  @IsOptional()
  @IsUUID()
  categoriaId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  glosa?: string | null;
}

/** Body de POST /comandos/EliminarPlantillaMovimiento. */
export class EliminarPlantillaMovimientoDto {
  @IsUUID()
  plantillaId!: string;
}
