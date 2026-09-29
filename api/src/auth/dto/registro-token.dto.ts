import { IsEmail, IsOptional, Matches } from 'class-validator';

export class RegistroTokenDto {
  /** Si se envía, el token queda ligado a este email y se manda ahí. */
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class VerificarCodigoRegistroDto {
  @IsEmail()
  email!: string;

  /** Código de 6 dígitos enviado por email (G4). */
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' })
  codigo!: string;
}
