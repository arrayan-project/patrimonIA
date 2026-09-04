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
  createdAt: string;
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

export function toElementoDTO(
  e: ElementoRow,
  propietarios: (PropietarioRow & { nombre?: string })[],
  estadoOperativo: string | null = null,
): ElementoPatrimonialDTO {
  const fecha = (d: Date | null) => (d === null ? null : d.toISOString().slice(0, 10));
  const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));
  return {
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo,
    categoriaFuncional: e.categoria_funcional,
    ambito: e.ambito,
    valorVigente: Number(e.valor_vigente),
    moneda: e.moneda,
    participaValorLiquido: e.participa_valor_liquido,
    participaConsolidacion: e.participa_consolidacion,
    admiteValorizacion: e.admite_valorizacion,
    visibilidad: e.visibilidad,
    estado: e.estado,
    valorPendiente: e.valor_pendiente === null ? null : Number(e.valor_pendiente),
    createdAt: e.created_at.toISOString(),
    propietarios: propietarios.map((p) => ({
      usuarioId: p.usuario_id,
      ...(p.nombre ? { nombre: p.nombre } : {}),
      porcentaje: Number(p.porcentaje),
    })),
    contraparte: e.contraparte ?? null,
    fechaInicio: fecha(e.fecha_inicio),
    fechaTermino: fecha(e.fecha_termino),
    cuotaMonto: num(e.cuota_monto),
    tasaInteres: num(e.tasa_interes),
    observaciones: e.observaciones ?? null,
    valorPendienteInicial: num(e.valor_pendiente_inicial),
    estadoOperativo,
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
