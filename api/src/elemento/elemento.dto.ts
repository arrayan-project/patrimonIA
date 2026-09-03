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
): ElementoPatrimonialDTO {
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
