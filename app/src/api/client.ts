import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = { token?: string | null; body?: unknown };

async function req<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_URL})`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('\n') : (msg ?? res.statusText));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => req<T>('GET', path, { token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    req<T>('POST', path, { body, token }),
};

// ── Tipos de respuesta del backend ──────────────────────────────────────────

export interface UsuarioDTO {
  id: string;
  email: string;
  nombre: string;
  estado: string;
  createdAt: string;
}

export interface LoginResult {
  accessToken: string;
  usuario: { id: string; email: string; nombre: string };
}

export interface HogarDTO {
  id: string;
  nombre: string;
  monedaConsolidacion: string;
  createdAt: string;
  miembros?: MiembroDTO[];
}

export interface MiembroDTO {
  usuarioId: string;
  nombre: string;
  email: string;
  rol: string;
  desde: string;
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
