/**
 * G33 bloque 9 — un miembro le pide a otro que anote una TRANSFERENCIA hacia una
 * cuenta suya: su parte de un gasto compartido (D-7) o una transferencia que no
 * anotó ("Avisarle a [miembro]"). Lo entrega GET /usuarios/me/solicitudes.
 */
export interface SolicitudDTO {
  id: string;
  motivo: 'GASTO_COMPARTIDO' | 'SIN_ANOTAR';
  estado: 'PENDIENTE' | 'PAGADA' | 'RECHAZADA' | 'ANULADA';
  /** ENVIADA: la pediste tú. RECIBIDA: te toca anotarla. */
  direccion: 'ENVIADA' | 'RECIBIDA';
  solicitante: { id: string; nombre: string };
  destinatario: { id: string; nombre: string };
  monto: number;
  moneda: string;
  cuentaDestino: { id: string; nombre: string };
  /** En una recibida pendiente: false si quien la pidió dejó de compartir la cuenta. */
  cuentaDisponible: boolean;
  fecha: string;
  glosa: string | null;
  totalGasto: number | null;
  eventoGastoId: string | null;
  eventoPagoId: string | null;
  createdAt: string;
}

type Formato = (monto: number, moneda: string) => string;

/**
 * Lo que le toca a cada uno si se divide en partes iguales entre quien pagó y
 * `otros` miembros. Se redondea hacia abajo (sin decimales en CLP): lo que
 * sobra lo pone quien pagó, así las partes nunca suman más que el gasto.
 */
export function parteIgual(monto: number, otros: number, moneda: string): number {
  const decimales = moneda === 'CLP' ? 0 : 2;
  const f = 10 ** decimales;
  return Math.floor((monto / (otros + 1)) * f) / f;
}

/** "Juan, Nico y Ana". */
export function nombres(lista: string[]): string {
  return lista.length <= 1 ? (lista[0] ?? '') : `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`;
}

export const ESTADO_TEXTO: Record<SolicitudDTO['estado'], string> = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagado',
  RECHAZADA: 'Rechazado',
  ANULADA: 'Anulado',
};

/** Qué pasó, en una frase, desde el punto de vista de quien la mira. */
export function tituloSolicitud(s: SolicitudDTO): string {
  const de = s.glosa ? ` de ${s.glosa}` : '';
  if (s.motivo === 'GASTO_COMPARTIDO') {
    return s.direccion === 'ENVIADA'
      ? `Le pediste a ${s.destinatario.nombre} su parte${de}`
      : `${s.solicitante.nombre} te pidió tu parte${de}`;
  }
  return s.direccion === 'ENVIADA'
    ? `Le pediste a ${s.destinatario.nombre} anotar una transferencia`
    : `${s.solicitante.nombre} te pidió anotar una transferencia`;
}

/** Lo que explica la pantalla de pago, antes de elegir la cuenta. */
export function explicacionPago(s: SolicitudDTO, formato: Formato): string {
  if (s.motivo === 'GASTO_COMPARTIDO') {
    const total = s.totalGasto != null ? ` ${formato(s.totalGasto, s.moneda)}` : '';
    return `${s.solicitante.nombre} pagó${total}${s.glosa ? ` en ${s.glosa}` : ''}. Tu parte es ${formato(s.monto, s.moneda)}.`;
  }
  return `A ${s.solicitante.nombre} le llegaron ${formato(s.monto, s.moneda)} tuyos y no están anotados.`;
}

/** Una TRANSFERENCIA entre una cuenta tuya y la de otro miembro (GET /usuarios/me/transferencias-hogar). */
export interface TransferenciaHogarDTO {
  eventoId: string;
  direccion: 'ENVIADA' | 'RECIBIDA';
  miembro: { id: string; nombre: string };
  cuentaPropia: { id: string; nombre: string };
  monto: number;
  moneda: string;
  fecha: string;
  glosa: string | null;
}

export interface FilaEntre {
  key: string;
  emoji: string;
  titulo: string;
  detalle: string;
  monto: string;
  fecha: string;
  /** toca: te pidieron y no has pagado · espera: pediste y no te pagan · resuelto: lo demás. */
  grupo: 'toca' | 'espera' | 'resuelto';
  /** Recibida y pendiente: se puede pagar. */
  solicitudId?: string;
  eventoId?: string;
  /** La plata te llegó a ti. */
  positivo: boolean;
}

/** Cómo va una solicitud, desde el punto de vista de quien la mira. */
export function comoVa(s: SolicitudDTO): string {
  const otro = s.direccion === 'ENVIADA' ? s.destinatario.nombre : s.solicitante.nombre;
  if (s.direccion === 'ENVIADA') {
    if (s.estado === 'PENDIENTE') return `⏰ Le pediste a ${otro}`;
    if (s.estado === 'PAGADA') return `✅ ${otro} te pagó`;
    if (s.estado === 'RECHAZADA') return `❌ A ${otro} no le correspondía`;
    return '❌ Anulado';
  }
  if (s.estado === 'PENDIENTE') return `⏰ ${otro} te pidió`;
  if (s.estado === 'PAGADA') return `✅ Le pagaste a ${otro}`;
  if (s.estado === 'RECHAZADA') return '❌ No te correspondía';
  return '❌ Anulado';
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' → "8 oct" (con el año si no es el actual). */
export function diaCorto(iso: string, hoy: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const dia = `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]}`;
  return Number(m[1]) === hoy.getFullYear() ? dia : `${dia} ${m[1]}`;
}

/**
 * HZ-21 — "Entre [miembro] y tú": las solicitudes en las dos direcciones y las
 * transferencias entre ustedes. Una transferencia que pagó una solicitud no se
 * repite: ya aparece como "Pagado". Solo lectura.
 */
export function filasEntre(
  solicitudes: SolicitudDTO[],
  transferencias: TransferenciaHogarDTO[],
  formato: Formato,
): FilaEntre[] {
  const pagos = new Set(solicitudes.map((s) => s.eventoPagoId).filter((x): x is string => !!x));
  // Arriba en qué fue (corto, no se corta); abajo cómo va, con quién y cuándo.
  const filas: FilaEntre[] = solicitudes.map((s) => {
    const fecha = s.fecha.slice(0, 10);
    return {
      key: `s-${s.id}`,
      emoji: '🧾',
      titulo: s.glosa ?? (s.motivo === 'GASTO_COMPARTIDO' ? 'Gasto compartido' : 'Transferencia sin anotar'),
      detalle: `${comoVa(s)} · ${diaCorto(fecha)}`,
      monto: formato(s.monto, s.moneda),
      fecha,
      grupo: s.estado !== 'PENDIENTE' ? 'resuelto' : s.direccion === 'RECIBIDA' ? 'toca' : 'espera',
      solicitudId: s.direccion === 'RECIBIDA' && s.estado === 'PENDIENTE' ? s.id : undefined,
      // Ya pagada: abre la transferencia con que se pagó.
      eventoId: s.eventoPagoId ?? undefined,
      positivo: s.direccion === 'ENVIADA',
    };
  });
  for (const t of transferencias) {
    if (pagos.has(t.eventoId)) continue;
    const llega = t.direccion === 'RECIBIDA';
    filas.push({
      key: `e-${t.eventoId}`,
      emoji: '🔁',
      titulo: t.glosa ?? (llega ? `${t.miembro.nombre} te transfirió` : `Le transferiste a ${t.miembro.nombre}`),
      detalle: `${t.cuentaPropia.nombre} · ${diaCorto(t.fecha)}`,
      monto: formato(t.monto, t.moneda),
      fecha: t.fecha,
      grupo: 'resuelto',
      eventoId: t.eventoId,
      positivo: llega,
    });
  }
  // Lo que te toca primero; dentro de cada grupo, lo más nuevo arriba.
  const orden = { toca: 0, espera: 1, resuelto: 2 };
  return filas.sort(
    (a, b) => orden[a.grupo] - orden[b.grupo] || b.fecha.localeCompare(a.fecha) || a.key.localeCompare(b.key),
  );
}
