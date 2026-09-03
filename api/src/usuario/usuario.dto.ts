import type { usuario as UsuarioRow } from '@prisma/client';

/** Proyección pública de Usuario — nunca expone password_hash. */
export interface UsuarioDTO {
  id: string;
  email: string;
  nombre: string;
  estado: string;
  createdAt: string;
}

export function toUsuarioDTO(u: UsuarioRow): UsuarioDTO {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    estado: u.estado,
    createdAt: u.created_at.toISOString(),
  };
}
