import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export const TIPOS_PRESUPUESTO = ['INDIVIDUAL', 'FAMILIAR'] as const;
export const PERIODICIDADES = ['PERIODICO', 'ESPECIFICO'] as const;
export const INTERVALOS = ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;

/** Body de POST /comandos/CrearPresupuesto (API_DESIGN K, AS #49). */
export class CrearPresupuestoDto {
  @IsIn(TIPOS_PRESUPUESTO)
  tipo!: (typeof TIPOS_PRESUPUESTO)[number];

  @IsIn(PERIODICIDADES)
  periodicidad!: (typeof PERIODICIDADES)[number];

  /** Obligatorio si tipo = FAMILIAR (validado en el service). */
  @IsOptional()
  @IsUUID()
  hogarId?: string;

  /** Obligatorio si periodicidad = PERIODICO. NULL si ESPECIFICO. */
  @IsOptional()
  @IsIn(INTERVALOS)
  intervalo?: (typeof INTERVALOS)[number];

  /** PERIODICO: ancla del primer período (por defecto, hoy). ESPECIFICO: inicio del propósito. */
  @IsOptional()
  @IsISO8601()
  fechaInicio?: string;

  /** Solo ESPECIFICO. PERIODICO la deriva del intervalo. */
  @IsOptional()
  @IsISO8601()
  fechaFin?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ingresosEsperados?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastosEsperados?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ahorroEsperado?: number;
}

/** Body de POST /comandos/ActualizarDatosPresupuesto (AS #50). tipo/periodicidad no se tocan. */
export class ActualizarPresupuestoDto {
  @IsUUID()
  presupuestoId!: string;

  @IsOptional()
  @IsIn(INTERVALOS)
  intervalo?: (typeof INTERVALOS)[number];

  @IsOptional()
  @IsISO8601()
  fechaInicio?: string;

  @IsOptional()
  @IsISO8601()
  fechaFin?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ingresosEsperados?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  gastosEsperados?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  ahorroEsperado?: number;
}

/** Body de POST /comandos/CerrarPresupuesto (AS #51). Solo presupuestos ESPECIFICOs. */
export class CerrarPresupuestoDto {
  @IsUUID()
  presupuestoId!: string;

  @IsString()
  @MinLength(3)
  motivo!: string;
}

/** Body de POST /comandos/EliminarPresupuesto (AS #52). */
export class EliminarPresupuestoDto {
  @IsUUID()
  presupuestoId!: string;

  @IsString()
  @MinLength(3)
  motivo!: string;
}
