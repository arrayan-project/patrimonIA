import { IsEmail, IsOptional } from 'class-validator';

export class RegistroTokenDto {
  /** Si se envía, el token queda ligado a este email y se manda ahí. */
  @IsOptional()
  @IsEmail()
  email?: string;
}
