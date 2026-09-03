import { IsString, IsUUID, MinLength } from 'class-validator';

/** Body de POST /comandos/AnularEventoFinanciero (API_DESIGN D, AS #11). */
export class AnularEventoDto {
  @IsUUID()
  eventoId!: string;

  /** Obligatorio (DDD Sección T — "Anulación: motivo"). */
  @IsString()
  @MinLength(3)
  motivo!: string;
}
