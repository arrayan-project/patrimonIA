import { api, type HogarDTO, type MiembroDTO } from './api/client';
import { money } from './format';
import { filasEntre, type FilaEntre, type SolicitudDTO, type TransferenciaHogarDTO } from './solicitudes';

export interface EntreMiembros {
  titulo: string;
  filas: FilaEntre[];
  otros: MiembroDTO[];
}

/**
 * HZ-21 — lo que pasa entre los miembros del hogar y tú: solicitudes en las dos
 * direcciones y las transferencias de los últimos 30 días. Lo usan Hogar y la
 * lista completa ("Entre ustedes").
 */
export async function cargarEntreMiembros(token: string, usuarioId: string, hogarId: string): Promise<EntreMiembros> {
  const [solicitudes, transferencias, hogar] = await Promise.all([
    api.get<SolicitudDTO[]>('/usuarios/me/solicitudes', token),
    api.get<TransferenciaHogarDTO[]>('/usuarios/me/transferencias-hogar?dias=30', token),
    api.get<HogarDTO>(`/hogares/${hogarId}`, token),
  ]);
  const otros = (hogar.miembros ?? []).filter((m) => m.usuarioId !== usuarioId);
  return {
    titulo: otros.length === 1 ? `Entre ${otros[0].nombre} y tú` : 'Entre el hogar y tú',
    filas: filasEntre(solicitudes, transferencias, money),
    otros,
  };
}
