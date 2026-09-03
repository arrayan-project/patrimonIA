import { IsNumber, IsPositive, IsString, IsUUID, MinLength } from 'class-validator';

export class CrearReservaDto {
  @IsUUID() asignacionId!: string;
  @IsUUID() elementoOrigenId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() monto!: number;
}

export class AjustarMontoReservaDto {
  @IsUUID() reservaId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() nuevoMonto!: number;
}

export class LiberarReservaDto {
  @IsUUID() reservaId!: string;
  @IsString() @MinLength(3) motivo!: string;
}
