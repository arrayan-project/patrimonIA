/** Payload del JWT de usuario autenticado. `sub` = usuario.id. */
export interface JwtPayload {
  sub: string;
  email: string;
}

/** Usuario autenticado disponible en el request tras pasar el guard. */
export interface UsuarioAutenticado {
  id: string;
  email: string;
}
