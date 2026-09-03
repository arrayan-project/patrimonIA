import { IsISO8601, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

/** Body de POST /comandos/RegistrarValorizacion (API_DESIGN G, AS #17). */
export class RegistrarValorizacionDto {
  @IsUUID()
  elementoId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorNuevo!: number;

  /** Fecha del cambio de valor (YYYY-MM-DD). Default: hoy. */
  @IsOptional()
  @IsISO8601()
  fecha?: string;
}
