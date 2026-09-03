import { IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

/** Body de POST /comandos/RegistrarAjustePatrimonial (API_DESIGN L, AS #20). */
export class RegistrarAjusteDto {
  @IsUUID()
  elementoId!: string;

  /** Con signo: + sube el patrimonio registrado, − lo baja. */
  @IsNumber({ maxDecimalPlaces: 2 })
  monto!: number;

  /** Obligatorio, sin excepción (DDD Sección T / W). */
  @IsString()
  @MinLength(3)
  motivo!: string;

  @IsOptional()
  @IsISO8601()
  fecha?: string;
}
