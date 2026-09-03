import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';

/** Body de POST /comandos/RegistrarTipoCambio (comando nº 53). */
export class RegistrarTipoCambioDto {
  @IsString()
  @Length(3, 3)
  monedaOrigen!: string;

  @IsString()
  @Length(3, 3)
  monedaDestino!: string;

  /** 1 unidad de monedaOrigen = `tasa` unidades de monedaDestino. */
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  tasa!: number;

  /** Por defecto, hoy. */
  @IsOptional()
  @IsISO8601()
  fechaVigencia?: string;

  @IsOptional()
  @IsString()
  fuente?: string;
}
