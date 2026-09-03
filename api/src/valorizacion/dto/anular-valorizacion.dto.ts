import { IsString, IsUUID, MinLength } from 'class-validator';

/** Body de POST /comandos/AnularValorizacion (API_DESIGN G, AS #18). */
export class AnularValorizacionDto {
  @IsUUID()
  valorizacionId!: string;

  @IsString()
  @MinLength(3)
  motivo!: string;
}
