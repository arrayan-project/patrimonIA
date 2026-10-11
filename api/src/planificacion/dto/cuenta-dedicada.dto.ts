import { IsBoolean, IsUUID } from 'class-validator';

/** Bloque M — "🏦 Esta cuenta es para esta meta". */
export class DedicarCuentaAObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsUUID() elementoId!: string;
}

/**
 * Bloque M — quitar una cuenta de una meta. `conservarComoApartado` es
 * obligatorio y sin valor por defecto (Juan, 2026-10-11: se pregunta, sin
 * opción preelegida): si es true, lo que tiene la cuenta queda como apartado fijo.
 */
export class QuitarCuentaDeObjetivoDto {
  @IsUUID() objetivoId!: string;
  @IsUUID() elementoId!: string;
  @IsBoolean() conservarComoApartado!: boolean;
}
