import type {
  elemento_patrimonial as ElementoRow,
  elemento_propietario as PropietarioRow,
  impacto_patrimonial as ImpactoRow,
} from '@prisma/client';

export interface PropietarioDTO {
  usuarioId: string;
  nombre?: string;
  porcentaje: number;
}

export interface ElementoPatrimonialDTO {
  id: string;
  nombre: string;
  tipo: string;
  categoriaFuncional: string;
  ambito: string;
  valorVigente: number;
  moneda: string;
  participaValorLiquido: boolean;
  participaConsolidacion: boolean;
  admiteValorizacion: boolean;
  visibilidad: string;
  estado: string;
  /** Solo DEUDA/CREDITO: saldo pendiente (magnitud positiva). NULL en el resto. */
  valorPendiente: number | null;
  /** §B1: true si el propietario no comparte el VALOR — los montos vienen en 0. */
  valorOculto: boolean;
  /** Nivel por tipo de información. Solo se envía al propietario (para editarlo). */
  visibilidadPorTipo: { EXISTENCIA: string; VALOR: string; MOVIMIENTOS: string } | null;
  /** Usuarios con los que se comparte (nivel COMPARTIDA). Solo al propietario. */
  compartidoCon: string[] | null;
  createdAt: string;
  /** P10: entrada al patrimonio (para la reconstrucción histórica). */
  fechaAlta: string;
  /** P10: salida del patrimonio (Desactivar). NULL si sigue vigente. */
  fechaBaja: string | null;
  propietarios: PropietarioDTO[];

  // Info adicional de DEUDA/CREDITO (§B3). NULL fuera de esas categorías.
  contraparte: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  cuotaMonto: number | null;
  tasaInteres: number | null;
  observaciones: string | null;
  valorPendienteInicial: number | null;
  /** Estado operativo derivado (§B2): VIGENTE·PARCIALMENTE_PAGADA·EN_MORA·SALDADA·CONDONADA·INCOBRABLE. */
  estadoOperativo: string | null;
}

export interface ImpactoPatrimonialDTO {
  id: string;
  elementoId: string;
  monto: number;
  origenTipo: string;
  origenId: string;
  createdAt: string;
}

export interface OpcionesElementoDTO {
  estadoOperativo?: string | null;
  /** El actor no puede ver el VALOR: los montos se envían en 0 y valorOculto=true. */
  ocultarValor?: boolean;
  /** Solo para el propietario: config de visibilidad por tipo + lista de compartidos. */
  visibilidadPorTipo?: { EXISTENCIA: string; VALOR: string; MOVIMIENTOS: string } | null;
  compartidoCon?: string[] | null;
}

export function toElementoDTO(
  e: ElementoRow,
  propietarios: (PropietarioRow & { nombre?: string })[],
  opciones: OpcionesElementoDTO = {},
): ElementoPatrimonialDTO {
  const oculto = opciones.ocultarValor === true;
  const fecha = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));
  const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));
  const numOculto = (d: unknown) => (oculto ? null : num(d));
  return {
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo,
    categoriaFuncional: e.categoria_funcional,
    ambito: e.ambito,
    valorVigente: oculto ? 0 : Number(e.valor_vigente),
    moneda: e.moneda,
    participaValorLiquido: e.participa_valor_liquido,
    participaConsolidacion: e.participa_consolidacion,
    admiteValorizacion: e.admite_valorizacion,
    visibilidad: e.visibilidad,
    estado: e.estado,
    valorPendiente: oculto ? null : e.valor_pendiente === null ? null : Number(e.valor_pendiente),
    valorOculto: oculto,
    visibilidadPorTipo: opciones.visibilidadPorTipo ?? null,
    compartidoCon: opciones.compartidoCon ?? null,
    createdAt: e.created_at.toISOString(),
    fechaAlta: fecha(e.fecha_alta) ?? e.created_at.toISOString().slice(0, 10),
    fechaBaja: fecha(e.fecha_baja),
    propietarios: propietarios.map((p) => ({
      usuarioId: p.usuario_id,
      ...(p.nombre ? { nombre: p.nombre } : {}),
      porcentaje: Number(p.porcentaje),
    })),
    contraparte: oculto ? null : (e.contraparte ?? null),
    fechaInicio: oculto ? null : fecha(e.fecha_inicio),
    fechaTermino: oculto ? null : fecha(e.fecha_termino),
    cuotaMonto: numOculto(e.cuota_monto),
    tasaInteres: numOculto(e.tasa_interes),
    observaciones: oculto ? null : (e.observaciones ?? null),
    valorPendienteInicial: numOculto(e.valor_pendiente_inicial),
    estadoOperativo: opciones.estadoOperativo ?? null,
  };
}

export function toImpactoDTO(i: ImpactoRow): ImpactoPatrimonialDTO {
  return {
    id: i.id,
    elementoId: i.elemento_id,
    monto: Number(i.monto),
    origenTipo: i.origen_tipo,
    origenId: i.origen_id,
    createdAt: i.created_at.toISOString(),
  };
}
