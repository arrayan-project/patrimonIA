import { IsNumber, IsString, IsUUID, MinLength } from 'class-validator';

/**
 * Body de POST /comandos/CorregirAjustePatrimonial (API_DESIGN L, AS #22).
 * En Ajuste Patrimonial la corrección compensa montos (flujo).
 */
export class CorregirAjusteDto {
  @IsUUID()
  ajusteId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  nuevoMonto!: number;

  @IsString()
  @MinLength(3)
  motivo!: string;
}
