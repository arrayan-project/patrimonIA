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

type Options = {
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

/**
 * Se invoca cuando una request autenticada recibe 401 (token expirado o
 * revocado). La app lo usa para cerrar sesión y volver al login.
 */
let alExpirarSesion: (() => void) | null = null;
export function registrarManejadorSesionExpirada(fn: (() => void) | null): void {
  alExpirarSesion = fn;
}

/** `true` cuando el fallo fue de red (no llegó respuesta del servidor). */
export function esErrorDeRed(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 0;
}

// ── Estado de conexión (E7) ────────────────────────────────────────────────
// Se marca sin red cuando un fetch falla sin respuesta, y con red apenas
// llega cualquier respuesta HTTP (aunque sea un 4xx/5xx: el servidor contestó).
let hayRed = true;
const oyentesRed = new Set<(v: boolean) => void>();
function setHayRed(v: boolean): void {
  if (v === hayRed) return;
  hayRed = v;
  oyentesRed.forEach((fn) => fn(v));
}
export function estadoRed(): boolean {
  return hayRed;
}
export function observarRed(fn: (v: boolean) => void): () => void {
  oyentesRed.add(fn);
  return () => {
    oyentesRed.delete(fn);
  };
}

async function req<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    setHayRed(false);
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_URL})`);
  }
  setHayRed(true);

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    if (res.status === 401 && opts.token) alExpirarSesion?.();
    const msg = data?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('\n') : (msg ?? res.statusText));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => req<T>('GET', path, { token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    req<T>('POST', path, { body, token }),
  postWith: <T>(path: string, body: unknown, headers: Record<string, string>) =>
    req<T>('POST', path, { body, headers }),
  del: <T>(path: string, body?: unknown, token?: string | null) =>
    req<T>('DELETE', path, { body, token }),
  /** POST de comando con Idempotency-Key para que un reintento no duplique. */
  comando: <T>(path: string, body: unknown, token: string | null | undefined, idempotencyKey: string) =>
    req<T>('POST', path, { body, token, idempotencyKey }),
};

// ── Tipos de respuesta del backend ──────────────────────────────────────────

export interface UsuarioDTO {
  id: string;
  email: string;
  nombre: string;
  estado: string;
  preferencias: Record<string, unknown> | null;
  createdAt: string;
}

export interface CategoriaMovimientoDTO {
  id: string;
  hogarId: string;
  nombre: string;
  tipoAplicable: 'INGRESO' | 'GASTO' | 'AMBOS';
  color: string | null;
  icono: string | null;
  orden: number;
  estado: 'ACTIVA' | 'ARCHIVADA';
  categoriaPadreId: string | null;
}

export interface TipoElementoDTO {
  id: string;
  hogarId: string;
  nombre: string;
  categoriaSugerida: 'LIQUIDEZ' | 'RESERVA' | 'INVERSION' | 'ACTIVO' | 'DEUDA' | 'CREDITO' | null;
  orden: number;
  estado: 'ACTIVA' | 'ARCHIVADA';
}

export interface EtiquetaDTO {
  id: string;
  nombre: string;
  color: string | null;
}

export interface AgrupacionDTO {
  id: string;
  nombre: string;
  color: string | null;
  orden: number;
  elementoIds: string[];
}

export interface PlantillaMovimientoDTO {
  id: string;
  nombre: string;
  tipo: 'INGRESO' | 'GASTO' | 'TRANSFERENCIA';
  monto: number | null;
  moneda: string | null;
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  categoriaId: string | null;
  glosa: string | null;
  orden: number;
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
  /** §B1: el propietario no comparte el VALOR — los montos vienen en 0. */
  valorOculto: boolean;
  /** Nivel por tipo de información. Solo presente si eres propietario. */
  visibilidadPorTipo: { EXISTENCIA: string; VALOR: string; MOVIMIENTOS: string } | null;
  /** Usuarios con los que se comparte (nivel COMPARTIDA). Solo si eres propietario. */
  compartidoCon: string[] | null;
  createdAt: string;
  propietarios: PropietarioDTO[];
  // Info adicional de DEUDA/CREDITO (§B3). null fuera de esas categorías.
  contraparte: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  cuotaMonto: number | null;
  tasaInteres: number | null;
  observaciones: string | null;
  valorPendienteInicial: number | null;
  /** §B2: VIGENTE · PARCIALMENTE_PAGADA · EN_MORA · SALDADA · CONDONADA · INCOBRABLE · null. */
  estadoOperativo: string | null;
}

export interface EventoFinancieroDTO {
  id: string;
  tipo: string;
  monto: number;
  moneda: string;
  fecha: string;
  anulado: boolean;
  correccionDeId: string | null;
  glosa: string | null;
  categoriaId: string | null;
  etiquetaIds: string[];
  createdAt: string;
  impactos: { id: string; elementoId: string; monto: number }[];
}

export interface PatrimonioIndividualDTO {
  usuarioId: string;
  elementos: number;
  porMoneda: {
    moneda: string;
    patrimonio: number;
    valorLiquido: number;
    valorReservado: number;
    valorLibre: number;
  }[];
}

/** Reserva ACTIVA vista desde el elemento que la financia (A2). */
export interface ReservaDeElementoDTO {
  id: string;
  monto: number;
  asignacionId: string;
  asignacionNombre: string;
  objetivoId: string | null;
  objetivoNombre: string | null;
  createdAt: string;
}

export interface EntradaHistorialDTO {
  id: string;
  comando: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  valorAnterior: Record<string, unknown> | null;
  valorPosterior: Record<string, unknown> | null;
  motivo: string | null;
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

export interface PresupuestoLineaDTO {
  id: string;
  presupuestoId: string;
  categoriaId: string;
  nombre: string;
  color: string | null;
  tipoAplicable: 'INGRESO' | 'GASTO' | 'AMBOS';
  montoEsperado: number;
}

export interface DesviacionRubroDTO {
  categoriaId: string;
  nombre: string;
  color: string | null;
  tipoAplicable: 'INGRESO' | 'GASTO' | 'AMBOS';
  esperado: number;
  real: number;
  desviacion: number;
}

export interface PresupuestoLineaAhorroDTO {
  id: string;
  presupuestoId: string;
  objetivoId: string;
  nombre: string;
  montoEsperado: number;
}

export interface DesviacionObjetivoDTO {
  objetivoId: string;
  nombre: string;
  esperado: number;
  real: number;
  desviacion: number;
}

export interface DesviacionPresupuestariaDTO {
  presupuestoId: string;
  periodo: { desde: string | null; hasta: string | null };
  esperado: { ingresos: number; gastos: number; ahorro: number };
  real: { ingresos: number; gastos: number; ahorro: number };
  desviacion: { ingresos: number; gastos: number; ahorro: number };
  porRubro: DesviacionRubroDTO[];
  porObjetivo: DesviacionObjetivoDTO[];
  sinClasificar: { ingresos: number; gastos: number };
}

export interface NotificacionDTO {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  entidadTipo: string | null;
  entidadId: string | null;
  leida: boolean;
  createdAt: string;
}

export interface TipoCambioDTO {
  id: string;
  monedaOrigen: string;
  monedaDestino: string;
  tasa: number;
  fechaVigencia: string;
  fuente: string | null;
  createdAt: string;
}

export interface PatrimonioConsolidadoDTO {
  hogarId: string;
  monedaConsolidacion: string;
  porMoneda: {
    moneda: string;
    patrimonioNeto: number;
    activos: number;
    pasivos: number;
    valorLiquido: number;
  }[];
  elementos: number;
  miembros: number;
  total: number | null;
  conversionesFaltantes: string[];
}

export interface MetricasHogarDTO {
  hogarId: string;
  porMoneda: {
    moneda: string;
    patrimonioNeto: number;
    activos: number;
    pasivos: number;
    liquidez: number | null;
    distribucionPorActivo: { categoria: string; valor: number; porcentaje: number }[];
    distribucionPorPasivo: { categoria: string; valor: number; porcentaje: number }[];
  }[];
  objetivos: {
    total: number;
    enProgreso: number;
    completados: number;
    montoObjetivoTotal: number;
    progresoTotal: number;
    avancePorcentaje: number | null;
  };
}

export interface VariacionPatrimonialDTO {
  usuarioId: string;
  desde: string;
  hasta: string;
  porMoneda: {
    moneda: string;
    patrimonioDesde: number;
    patrimonioHasta: number;
    variacion: number;
    variacionPorcentaje: number | null;
  }[];
}

export interface PatrimonioHistoricoDTO {
  usuarioId: string;
  fecha: string;
  porMoneda: { moneda: string; patrimonio: number }[];
  elementos: number;
}

export interface ValorHistoricoElementoDTO {
  elementoId: string;
  fecha: string;
  moneda: string;
  valor: number;
}

export interface SeriePatrimonialDTO {
  usuarioId: string;
  desde: string;
  hasta: string;
  puntos: { fecha: string; porMoneda: { moneda: string; patrimonio: number }[] }[];
}

export type AlcanceReporte = 'mios' | 'hogar';

export interface TotalesPorMoneda {
  moneda: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

export interface RubroReporteDTO {
  categoriaId: string | null;
  nombre: string;
  color: string | null;
  tipo: 'INGRESO' | 'GASTO';
  total: number;
}

export interface MovimientoReporteDTO {
  eventoId: string;
  fecha: string;
  tipo: string;
  monto: number;
  moneda: string;
  glosa: string | null;
  categoriaId: string | null;
  etiquetaIds: string[];
  corregido: boolean;
}

export interface ResumenFinancieroDTO {
  periodo: { desde: string; hasta: string };
  alcance: AlcanceReporte;
  porMoneda: TotalesPorMoneda[];
  porRubro: RubroReporteDTO[];
  movimientos: MovimientoReporteDTO[];
}

export interface ResumenAnualDTO {
  anio: number;
  alcance: AlcanceReporte;
  meses: { mes: number; porMoneda: TotalesPorMoneda[] }[];
}

export interface MovimientoProgramadoDTO {
  id: string;
  tipo: 'INGRESO' | 'GASTO' | 'TRANSFERENCIA';
  montoPlanificado: number;
  moneda: string;
  fechaProgramada: string;
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  observaciones: string | null;
  estado: 'PENDIENTE' | 'MATERIALIZADO' | 'CANCELADO';
  eventoFinancieroId: string | null;
  createdAt: string;
}
