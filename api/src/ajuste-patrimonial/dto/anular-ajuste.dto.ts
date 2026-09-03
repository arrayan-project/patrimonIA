import { IsString, IsUUID, MinLength } from 'class-validator';

/** Body de POST /comandos/AnularAjustePatrimonial (API_DESIGN L, AS #21). */
export class AnularAjusteDto {
  @IsUUID()
  ajusteId!: string;

  @IsString()
  @MinLength(3)
  motivo!: string;
}
