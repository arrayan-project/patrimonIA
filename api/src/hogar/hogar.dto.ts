import type {
  hogar as HogarRow,
  invitacion as InvitacionRow,
  membresia as MembresiaRow,
} from '@prisma/client';

export interface MiembroDTO {
  usuarioId: string;
  nombre: string;
  email: string;
  rol: string;
  desde: string;
}

export interface HogarDTO {
  id: string;
  nombre: string;
  monedaConsolidacion: string;
  createdAt: string;
  miembros?: MiembroDTO[];
}

export interface InvitacionDTO {
  id: string;
  hogarId: string;
  hogarNombre?: string;
  emisorId: string;
  invitadoId: string;
  estado: string;
  createdAt: string;
}

export interface MembresiaDTO {
  id: string;
  hogarId: string;
  usuarioId: string;
  rol: string;
  estado: string;
}

export function toHogarDTO(h: HogarRow, miembros?: MiembroDTO[]): HogarDTO {
  return {
    id: h.id,
    nombre: h.nombre,
    monedaConsolidacion: h.moneda_consolidacion,
    createdAt: h.created_at.toISOString(),
    ...(miembros ? { miembros } : {}),
  };
}

export function toInvitacionDTO(
  i: InvitacionRow,
  hogarNombre?: string,
): InvitacionDTO {
  return {
    id: i.id,
    hogarId: i.hogar_id,
    ...(hogarNombre ? { hogarNombre } : {}),
    emisorId: i.emisor_id,
    invitadoId: i.invitado_id,
    estado: i.estado,
    createdAt: i.created_at.toISOString(),
  };
}

export function toMembresiaDTO(m: MembresiaRow): MembresiaDTO {
  return {
    id: m.id,
    hogarId: m.hogar_id,
    usuarioId: m.usuario_id,
    rol: m.rol,
    estado: m.estado,
  };
}
