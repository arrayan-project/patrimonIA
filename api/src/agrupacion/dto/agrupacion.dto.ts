import { ArrayMaxSize, IsArray, IsHexColor, IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** Body de POST /comandos/CrearAgrupacion (GAPS.md G23). */
export class CrearAgrupacionDto {
  @IsString()
  @Length(1, 40)
  nombre!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

/** Body de POST /comandos/ActualizarAgrupacion. */
export class ActualizarAgrupacionDto {
  @IsUUID()
  agrupacionId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  nombre?: string;

  @IsOptional()
  @IsHexColor()
  color?: string | null;
}

/** Body de POST /comandos/EliminarAgrupacion. */
export class EliminarAgrupacionDto {
  @IsUUID()
  agrupacionId!: string;
}

/**
 * Body de POST /comandos/DefinirElementosAgrupacion — reemplaza el conjunto de
 * elementos de la agrupación. Un elemento que ya estaba en otra agrupación se
 * mueve a esta.
 */
export class DefinirElementosAgrupacionDto {
  @IsUUID()
  agrupacionId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  elementoIds!: string[];
}
