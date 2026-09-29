import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * INGRESO / GASTO / TRANSFERENCIA (Fase 2) + CONVERSION (Fase 13, cambio de
 * moneda entre dos elementos). PRESTAMO se modela vía Deuda/Crédito — ver GAPS.md G17.
 */
export const TIPOS_EVENTO = ['INGRESO', 'GASTO', 'TRANSFERENCIA', 'CONVERSION'] as const;

export class RegistrarEventoDto {
  @IsIn(TIPOS_EVENTO)
  tipo!: (typeof TIPOS_EVENTO)[number];

  /** Para CONVERSION es el monto en la moneda del elemento origen. */
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
   * se consumen reservas ACTIVAS de esa asignación (misma moneda) hasta el monto
   * del evento — dividiendo la última si hace falta (GAPS.md G14) — y se
   * recalcula el progreso del objetivo (DDD Sección T / W).
   */
  @IsOptional()
  @IsUUID()
  asignacionId?: string;

  /** Categoría del hogar (solo INGRESO/GASTO). Opcional. Ver GAPS.md G23. */
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  /** Anotación libre corta ("pago internet marzo"). Opcional. Ver GAPS.md G22. */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  glosa?: string;

  /** Etiquetas personales a adjuntar (0..N). Opcional. Ver GAPS.md G23. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  etiquetaIds?: string[];
}
