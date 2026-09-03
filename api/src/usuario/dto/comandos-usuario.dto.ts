import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class ActualizarDatosUsuarioDto {
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsObject() preferencias?: Record<string, unknown>;
}

export class DesactivarUsuarioDto {
  @IsString() @MinLength(3) motivo!: string;
}
