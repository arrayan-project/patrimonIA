import { IsEmail, IsString, MinLength } from 'class-validator';

export class SolicitarResetPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  /** Misma regla que RegistrarUsuarioDto.password. */
  @IsString()
  @MinLength(8)
  nuevaPassword!: string;
}
