import { IsOptional, IsString, Length, MinLength } from 'class-validator';

/** Body de POST /comandos/CrearHogar (API_DESIGN A, AS #34). */
export class CrearHogarDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  /**
   * El esquema exige moneda_consolidacion (NOT NULL) pero el comando CrearHogar
   * solo define "nombre" como input. Se acepta opcional con placeholder "CLP"
   * y se ajusta luego vía CambiarMonedaConsolidacion. Ver GAPS.md.
   */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  monedaConsolidacion?: string;
}
