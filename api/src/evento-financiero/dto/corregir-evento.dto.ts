import { IsNumber, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Body de POST /comandos/CorregirEventoFinanciero (API_DESIGN D, AS #12).
 * Fase 3: solo se corrige el monto. Cambiar tipo, fecha o elementos requiere
 * anular + registrar de nuevo (ver GAPS.md).
 */
export class CorregirEventoDto {
  @IsUUID()
  eventoId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  nuevoMonto!: number;

  /** Obligatorio (DDD Sección U — motivo en todo comando Corregir*). */
  @IsString()
  @MinLength(3)
  motivo!: string;
}
