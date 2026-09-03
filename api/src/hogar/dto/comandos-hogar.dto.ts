import { IsIn, IsString, IsUUID, Length, MinLength } from 'class-validator';

export class ActualizarDatosHogarDto {
  @IsUUID() hogarId!: string;
  @IsString() @MinLength(1) nombre!: string;
}

export class CambiarMonedaConsolidacionDto {
  @IsUUID() hogarId!: string;
  @IsString() @Length(3, 3) moneda!: string;
}

export class AsignarRolDto {
  @IsUUID() hogarId!: string;
  @IsUUID() usuarioId!: string;
  @IsIn(['ADMINISTRADOR', 'MIEMBRO']) rol!: 'ADMINISTRADOR' | 'MIEMBRO';
}

export class RemoverMiembroDto {
  @IsUUID() hogarId!: string;
  @IsUUID() usuarioId!: string;
  @IsString() @MinLength(3) motivo!: string;
}

export class EliminarHogarDto {
  @IsUUID() hogarId!: string;
  @IsString() @MinLength(3) motivo!: string;
}

export class SalirDeHogarDto {
  @IsUUID() hogarId!: string;
}
