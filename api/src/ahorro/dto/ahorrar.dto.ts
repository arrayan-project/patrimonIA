import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export class OrigenAhorroDto {
  @IsUUID() elementoId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto!: number;
}

/** D-1 — AhorrarParaObjetivo. */
export class AhorrarParaObjetivoDto {
  @IsUUID() objetivoId!: string;

  /** La parte de la meta; por defecto, la más antigua (o una nueva con el nombre de la meta). */
  @IsOptional() @IsUUID() asignacionId?: string;

  /**
   * La cuenta donde se guarda la plata de la meta. No se persiste: si falta,
   * se deriva de la cuenta propia con más ahorro en la meta.
   */
  @IsOptional() @IsUUID() destinoId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OrigenAhorroDto)
  origenes!: OrigenAhorroDto[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser YYYY-MM-DD' })
  fecha?: string;
}
