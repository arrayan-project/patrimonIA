import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DIRECCIONES = ['ENTRA', 'SALE'] as const;

/** D-3 / D-8 — RegistrarPlataDeOtraPersona. */
export class RegistrarPlataDeOtraPersonaDto {
  /** ENTRA: la plata llega a la cuenta (Recibí). SALE: sale de la cuenta (Gasté). */
  @IsIn(DIRECCIONES) direccion!: (typeof DIRECCIONES)[number];

  @IsUUID() cuentaId!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto!: number;

  /**
   * Nombre de la persona. La app lo toma de la lista de personas o de "Nueva
   * persona" (nunca de texto libre en el registro); se reúsa el saldo con el
   * mismo nombre, sin distinguir mayúsculas ni espacios.
   */
  @IsString() @MinLength(1) @MaxLength(80) persona!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha?: string;

  @IsOptional() @IsString() @MaxLength(200) glosa?: string;

  /**
   * HZ-20, solo con SALE: "Sí, la anoté como mía". Ese ingreso se anula y se
   * registra como plata que entró de la persona, en la misma transacción.
   */
  @IsOptional() @IsUUID() anularIngresoId?: string;

  /** HZ-20, solo con SALE: "No la anoté". Antes de la salida se registra la entrada. */
  @IsOptional() @IsBoolean() registrarEntrada?: boolean;
}
