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
  /** Solo DEUDA/CREDITO: saldo pendiente (magnitud positiva). */
  valorPendiente: number | null;
  createdAt: string;
  propietarios: PropietarioDTO[];
}

export interface EventoFinancieroDTO {
  id: string;
  tipo: string;
  monto: number;
  moneda: string;
  fecha: string;
  anulado: boolean;
  correccionDeId: string | null;
  createdAt: string;
  impactos: { id: string; elementoId: string; monto: number }[];
}

export interface PatrimonioIndividualDTO {
  usuarioId: string;
  elementos: number;
  porMoneda: { moneda: string; patrimonio: number; valorLiquido: number }[];
}

export interface ValorizacionDTO {
  id: string;
  elementoId: string;
  valorAnterior: number;
  valorNuevo: number;
  fecha: string;
  anulada: boolean;
  correccionDeId: string | null;
  createdAt: string;
}

export interface AjustePatrimonialDTO {
  id: string;
  elementoId: string;
  monto: number;
  motivo: string;
  fecha: string;
  anulado: boolean;
  correccionDeId: string | null;
  createdAt: string;
}

export interface ObjetivoFinancieroDTO {
  id: string;
  nombre: string;
  montoObjetivo: number;
  fechaObjetivo: string | null;
  estado: string;
  progreso: number;
  progresoPorcentaje: number;
  createdAt: string;
}

export interface ReservaDTO {
  id: string;
  asignacionId: string;
  elementoOrigenId: string;
  monto: number;
  estado: string;
  createdAt: string;
}

export interface AsignacionDTO {
  id: string;
  nombre: string;
  montoObjetivo: number | null;
  objetivoId: string | null;
  totalReservado: number;
  createdAt: string;
  reservas?: ReservaDTO[];
}

export interface PresupuestoDTO {
  id: string;
  tipo: 'INDIVIDUAL' | 'FAMILIAR';
  periodicidad: 'PERIODICO' | 'ESPECIFICO';
  intervalo: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  ingresosEsperados: number | null;
  gastosEsperados: number | null;
  ahorroEsperado: number | null;
  estado: string | null;
  usuarioId: string | null;
  hogarId: string | null;
  vigente: boolean;
  createdAt: string;
}

export interface DesviacionPresupuestariaDTO {
  presupuestoId: string;
  periodo: { desde: string | null; hasta: string | null };
  esperado: { ingresos: number; gastos: number; ahorro: number };
  real: { ingresos: number; gastos: number; ahorro: number };
  desviacion: { ingresos: number; gastos: number; ahorro: number };
}

export interface MovimientoProgramadoDTO {
  id: string;
  montoPlanificado: number;
  moneda: string;
  fechaProgramada: string;
  elementoDestinoId: string;
  observaciones: string | null;
  estado: 'PENDIENTE' | 'MATERIALIZADO' | 'CANCELADO';
  eventoFinancieroId: string | null;
  createdAt: string;
}
