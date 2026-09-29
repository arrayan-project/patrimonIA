import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class SolicitarResetPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  /** Código de 6 dígitos enviado por email (G31). */
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' })
  codigo!: string;

  /** Misma regla que RegistrarUsuarioDto.password. */
  @IsString()
  @MinLength(8)
  nuevaPassword!: string;
}
