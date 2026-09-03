import { IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsUUID, Length } from 'class-validator';

/**
 * Fase 2 (Flujo 1) cubre INGRESO / GASTO / TRANSFERENCIA. CONVERSION y PRESTAMO
 * quedan para ciclos siguientes (tipo de cambio y Deuda/Crédito) — ver GAPS.md.
 */
export const TIPOS_FASE_2 = ['INGRESO', 'GASTO', 'TRANSFERENCIA'] as const;

export class RegistrarEventoDto {
  @IsIn(TIPOS_FASE_2)
  tipo!: (typeof TIPOS_FASE_2)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;

  @Length(3, 3)
  moneda!: string;

  /** Fecha del hecho económico (YYYY-MM-DD). Default: hoy. */
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  /** Requerido para GASTO y TRANSFERENCIA. */
  @IsOptional()
  @IsUUID()
  elementoOrigenId?: string;

  /** Requerido para INGRESO y TRANSFERENCIA. */
  @IsOptional()
  @IsUUID()
  elementoDestinoId?: string;

  /**
   * Si se asocia a una asignación, dispara la política "Consumir reserva":
   * las reservas ACTIVAS de esa asignación pasan a CONSUMIDA y se recalcula el
   * progreso del objetivo (DDD Sección T / W).
   */
  @IsOptional()
  @IsUUID()
  asignacionId?: string;
}
