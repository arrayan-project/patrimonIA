import type { usuario as UsuarioRow } from '@prisma/client';

/** Proyección pública de Usuario — nunca expone password_hash. */
export interface UsuarioDTO {
  id: string;
  email: string;
  nombre: string;
  estado: string;
  /** Preferencias globales del usuario (formato de fecha, tema, etc.). Ver GAPS.md G25. */
  preferencias: Record<string, unknown> | null;
  createdAt: string;
}

export function toUsuarioDTO(u: UsuarioRow): UsuarioDTO {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    estado: u.estado,
    preferencias: (u.preferencias as Record<string, unknown> | null) ?? null,
    createdAt: u.created_at.toISOString(),
  };
}
