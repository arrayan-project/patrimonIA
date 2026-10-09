import { api, type ElementoPatrimonialDTO } from './api/client';

const ORDEN = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'CREDITO', 'DEUDA'];

export interface CuentasHogar {
  /** Lo que suma al hogar: lo tuyo y lo de los otros miembros, una vez cada una. */
  suman: ElementoPatrimonialDTO[];
  /** Cuentas de otros miembros a las que puedes transferir y que no suman (HZ-10 / D-2). */
  paraTransferir: ElementoPatrimonialDTO[];
}

/** Las cuentas y bienes del hogar, ordenados como el Inicio (Cuentas, Ahorro, …, Deudas). Lo usan Hogar y Patrimonio del hogar. */
export async function cargarCuentasHogar(token: string): Promise<CuentasHogar> {
  const [els, mios] = await Promise.all([
    api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token),
    api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
  ]);
  // `alcance=hogar` trae solo lo de los otros miembros: lo tuyo que suma al hogar va también.
  const vistos = new Set<string>();
  const suman = [...mios, ...els]
    .filter((e) => e.participaConsolidacion && e.estado === 'ACTIVO' && !vistos.has(e.id) && vistos.add(e.id))
    .sort(
      (a, b) =>
        ORDEN.indexOf(a.categoriaFuncional) - ORDEN.indexOf(b.categoriaFuncional) ||
        Math.abs(b.valorVigente) - Math.abs(a.valorVigente),
    );
  return {
    suman,
    paraTransferir: els.filter(
      (e) => !e.participaConsolidacion && e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO',
    ),
  };
}

/** De quién es: "🙋 Tuya", "👥 Tú y Pareja" o "👤 De Pareja". */
export function deQuien(e: ElementoPatrimonialDTO, usuarioId: string): string {
  const otros = e.propietarios.filter((p) => p.usuarioId !== usuarioId).map((p) => p.nombre ?? 'otra persona');
  const mia = e.propietarios.some((p) => p.usuarioId === usuarioId);
  if (otros.length === 0) return '🙋 Tuya';
  const lista = otros.length === 1 ? otros[0] : `${otros.slice(0, -1).join(', ')} y ${otros[otros.length - 1]}`;
  return mia ? `👥 Tú y ${lista}` : `👤 De ${lista}`;
}
