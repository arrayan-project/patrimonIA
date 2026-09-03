import { ArrayMaxSize, IsArray, IsHexColor, IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** Body de POST /comandos/CrearEtiqueta (GAPS.md G23). */
export class CrearEtiquetaDto {
  @IsString()
  @Length(1, 30)
  nombre!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

/** Body de POST /comandos/ActualizarEtiqueta. */
export class ActualizarEtiquetaDto {
  @IsUUID()
  etiquetaId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  nombre?: string;

  @IsOptional()
  @IsHexColor()
  color?: string | null;
}

/** Body de POST /comandos/EliminarEtiqueta. */
export class EliminarEtiquetaDto {
  @IsUUID()
  etiquetaId!: string;
}

/** Body de POST /comandos/EtiquetarEvento — reemplaza el conjunto de etiquetas. */
export class EtiquetarEventoDto {
  @IsUUID()
  eventoId!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  etiquetaIds!: string[];
}
