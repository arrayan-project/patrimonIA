import { IsUUID } from 'class-validator';

/** Body de AceptarInvitacion / RechazarInvitacion (AS #38, #39). */
export class InvitacionIdDto {
  @IsUUID()
  invitacionId!: string;
}
