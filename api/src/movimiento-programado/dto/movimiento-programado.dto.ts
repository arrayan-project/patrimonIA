import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body de POST /comandos/CrearMovimientoProgramado (API_DESIGN, AS #13). */
export class CrearMovimientoProgramadoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoPlanificado!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  moneda!: string;

  @IsISO8601()
  fechaProgramada!: string;

  @IsUUID()
  elementoDestinoId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

/** Body de POST /comandos/ActualizarMovimientoProgramado (AS #14). Solo si estado = PENDIENTE. */
export class ActualizarMovimientoProgramadoDto {
  @IsUUID()
  movimientoId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoPlanificado?: number;

  @IsOptional()
  @IsISO8601()
  fechaProgramada?: string;

  @IsOptional()
  @IsUUID()
  elementoDestinoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

/** Body de POST /comandos/MaterializarMovimientoProgramado (AS #15). */
export class MaterializarMovimientoProgramadoDto {
  @IsUUID()
  movimientoId!: string;

  /** Monto efectivo confirmado al materializar (por defecto, el planificado). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoEfectivo?: number;

  /** Fecha efectiva (por defecto, hoy). */
  @IsOptional()
  @IsISO8601()
  fechaEfectiva?: string;
}

/** Body de POST /comandos/CancelarMovimientoProgramado (AS #16). Solo si estado = PENDIENTE. */
export class CancelarMovimientoProgramadoDto {
  @IsUUID()
  movimientoId!: string;

  @IsString()
  @MinLength(3)
  motivo!: string;
}
