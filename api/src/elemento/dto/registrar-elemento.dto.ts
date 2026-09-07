import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Campos opcionales de DEUDA/CREDITO (REQUISITES §J). Compartidos por Registrar y Actualizar. */
export class DetalleDeudaDto {
  /** Acreedor (DEUDA) o deudor (CREDITO). */
  @IsOptional() @IsString() @MinLength(1) contraparte?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaInicio debe ser YYYY-MM-DD' })
  fechaInicio?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaTermino debe ser YYYY-MM-DD' })
  fechaTermino?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cuotaMonto?: number;

  /** % anual. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) tasaInteres?: number;

  @IsOptional() @IsString() observaciones?: string;
}

/**
 * Categorías de activo (Fase 2, Flujo 1) + DEUDA/CREDITO (Fase 8, Flujo 4).
 * Para DEUDA/CREDITO el atributo obligatorio es `valorPendiente` y el
 * `valor_vigente` se deriva con signo (DEUDA negativo, CREDITO positivo).
 */
export const CATEGORIAS_ELEMENTO = [
  'LIQUIDEZ',
  'RESERVA',
  'INVERSION',
  'ACTIVO',
  'DEUDA',
  'CREDITO',
] as const;
export const VISIBILIDADES = ['PRIVADA', 'COMPARTIDA', 'FAMILIAR'] as const;
export const AMBITOS = ['PERSONAL', 'HOGAR'] as const;
export const TIPOS_INFO_ELEMENTO = ['EXISTENCIA', 'VALOR', 'MOVIMIENTOS'] as const;

/** Naturaleza de un elemento DEUDA/CREDITO (GAPS.md G28). NULL fuera de esas categorías. */
export const NATURALEZAS_DEUDA = ['FINANCIERA', 'CUSTODIA_INFORMAL'] as const;

/**
 * §B1/§M — nivel de visibilidad por tipo de información. Ausente = hereda el
 * nivel base `visibilidad`. Compartido por DefinirVisibilidad y por el alta.
 */
export class NivelPorTipoDto {
  @IsOptional() @IsIn(VISIBILIDADES) EXISTENCIA?: (typeof VISIBILIDADES)[number];
  @IsOptional() @IsIn(VISIBILIDADES) VALOR?: (typeof VISIBILIDADES)[number];
  @IsOptional() @IsIn(VISIBILIDADES) MOVIMIENTOS?: (typeof VISIBILIDADES)[number];
}

export class PropietarioDto {
  @IsUUID()
  usuarioId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  porcentaje!: number;
}

export class RegistrarElementoDto extends DetalleDeudaDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsString()
  @MinLength(1)
  tipo!: string;

  @IsIn(CATEGORIAS_ELEMENTO)
  categoriaFuncional!: (typeof CATEGORIAS_ELEMENTO)[number];

  @IsOptional()
  @IsIn(AMBITOS)
  ambito?: (typeof AMBITOS)[number];

  /** Categorías de activo. Para DEUDA/CREDITO se ignora — manda `valorPendiente`. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorInicial?: number;

  /** Obligatorio y > 0 solo para categoría DEUDA o CREDITO (validado en el service). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorPendiente?: number;

  @IsString()
  @Length(3, 3)
  moneda!: string;

  /** P10 — fecha de entrada al patrimonio (YYYY-MM-DD). Por defecto hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaAlta debe ser YYYY-MM-DD' })
  fechaAlta?: string;

  @IsOptional()
  @IsBoolean()
  participaValorLiquido?: boolean;

  @IsOptional()
  @IsBoolean()
  participaConsolidacion?: boolean;

  @IsOptional()
  @IsBoolean()
  admiteValorizacion?: boolean;

  @IsOptional()
  @IsIn(VISIBILIDADES)
  visibilidad?: (typeof VISIBILIDADES)[number];

  /**
   * §M — visibilidad granular elegida en el alta (el wizard la pregunta
   * explícitamente). Ausente = todo hereda `visibilidad` (por defecto PRIVADA).
   * Se aplica en la misma transacción que la creación.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => NivelPorTipoDto)
  visibilidadPorTipo?: NivelPorTipoDto;

  /** Usuarios con los que se comparte cuando algún nivel es COMPARTIDA. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  compartidoCon?: string[];

  /** Solo DEUDA/CREDITO. Por defecto 'FINANCIERA'. Debe omitirse en otras categorías. */
  @IsOptional()
  @IsIn(NATURALEZAS_DEUDA)
  naturaleza?: (typeof NATURALEZAS_DEUDA)[number];

  /** Si se omite: [{ usuarioId: <actor>, porcentaje: 100 }]. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PropietarioDto)
  propietarios?: PropietarioDto[];
}
