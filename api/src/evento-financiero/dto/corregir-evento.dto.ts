import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Body de POST /comandos/CorregirEventoFinanciero (API_DESIGN D, AS #12).
 * GAPS.md P5 / G9: además del monto se puede corregir la fecha y la glosa del
 * movimiento (todos opcionales, al menos uno). El tipo y los elementos afectados
 * siguen requiriendo anular + registrar de nuevo. La cadena sigue siendo lineal:
 * un evento con una corrección viva no se vuelve a corregir (se corrige esa).
 */
export class CorregirEventoDto {
  @IsUUID()
  eventoId!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  nuevoMonto?: number;

  /** Nueva fecha del hecho económico (YYYY-MM-DD). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'nuevaFecha debe ser YYYY-MM-DD' })
  nuevaFecha?: string;

  /** Nueva glosa; cadena vacía la borra. */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  nuevaGlosa?: string;

  /** Obligatorio (DDD Sección U — motivo en todo comando Corregir*). */
  @IsString()
  @MinLength(3)
  motivo!: string;
}
