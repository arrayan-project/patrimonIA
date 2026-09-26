/** Payload del JWT de usuario autenticado. `sub` = usuario.id. */
export interface JwtPayload {
  sub: string;
  email: string;
  /** usuario.token_version al emitir; si ya no coincide, la sesión no vale (G31). */
  tv?: number;
  /** Solo en tokens de propósito acotado (registro, reset) — nunca en uno de sesión. */
  purpose?: string;
}

/** Usuario autenticado disponible en el request tras pasar el guard. */
export interface UsuarioAutenticado {
  id: string;
  email: string;
}
