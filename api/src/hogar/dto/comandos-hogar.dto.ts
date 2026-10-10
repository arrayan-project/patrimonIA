import { IsIn, IsInt, IsString, IsUUID, Length, Max, Min, MinLength } from 'class-validator';

export class ActualizarDatosHogarDto {
  @IsUUID() hogarId!: string;
  @IsString() @MinLength(1) nombre!: string;
}

export class CambiarMonedaConsolidacionDto {
  @IsUUID() hogarId!: string;
  @IsString() @Length(3, 3) moneda!: string;
}

/** G43: día en que parte el mes del hogar (1 = mes calendario). */
export class CambiarInicioMesHogarDto {
  @IsUUID() hogarId!: string;
  @IsInt() @Min(1) @Max(28) dia!: number;
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
