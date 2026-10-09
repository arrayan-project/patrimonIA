import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERIODICIDADES, type Periodicidad } from '../recurrencia.js';

export const TIPOS_MOV_PROGRAMADO = ['INGRESO', 'GASTO', 'TRANSFERENCIA'] as const;
export type TipoMovProgramado = (typeof TIPOS_MOV_PROGRAMADO)[number];

/** Body de POST /comandos/CrearMovimientoProgramado (API_DESIGN, AS #13). */
export class CrearMovimientoProgramadoDto {
  /** INGRESO usa destino; GASTO usa origen; TRANSFERENCIA usa ambos (§B5). */
  @IsIn(TIPOS_MOV_PROGRAMADO)
  tipo!: TipoMovProgramado;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoPlanificado!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  moneda!: string;

  @IsISO8601()
  fechaProgramada!: string;

  @IsOptional()
  @IsUUID()
  elementoOrigenId?: string;

  @IsOptional()
  @IsUUID()
  elementoDestinoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  /** D-6: se repite cada mes o cada año, el mismo día que `fechaProgramada`. */
  @IsOptional()
  @IsIn(PERIODICIDADES)
  periodicidad?: Periodicidad;

  /** D-6: solo INGRESO y GASTO (como en RegistrarEventoFinanciero, G23). */
  @IsOptional()
  @IsUUID()
  categoriaId?: string;
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
  elementoOrigenId?: string;

  @IsOptional()
  @IsUUID()
  elementoDestinoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @IsOptional()
  @IsUUID()
  categoriaId?: string;
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

  /**
   * D-6, "Dejar de repetir": la serie no genera más ocurrencias y se cancelan
   * las que aún no llegan. Las vencidas sin respuesta siguen pendientes.
   */
  @IsOptional()
  @IsBoolean()
  serie?: boolean;
}
