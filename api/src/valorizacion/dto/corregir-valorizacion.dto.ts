import { IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';

/**
 * Body de POST /comandos/CorregirValorizacion (API_DESIGN G, AS #19).
 * La corrección REEMPLAZA el valor vigente por el correcto — nunca suma
 * (una valorización es stock, no flujo; DDD Sección T).
 */
export class CorregirValorizacionDto {
  @IsUUID()
  valorizacionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorCorrecto!: number;

  @IsString()
  @MinLength(3)
  motivo!: string;
}
