import { IsEmail, IsString, MinLength } from 'class-validator';

/** Body de POST /comandos/RegistrarUsuario (API_DESIGN B, AS #43). */
export class RegistrarUsuarioDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
