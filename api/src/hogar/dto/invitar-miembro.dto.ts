import { IsEmail, IsUUID } from 'class-validator';

/** Body de POST /comandos/InvitarMiembro (API_DESIGN A, AS #37). */
export class InvitarMiembroDto {
  @IsUUID()
  hogarId!: string;

  /** API_DESIGN dice "usuario invitado"; el desglose de pantalla usa email. */
  @IsEmail()
  emailInvitado!: string;
}
