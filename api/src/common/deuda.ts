import { Prisma } from '@prisma/client';

export const CATEGORIAS_CON_PENDIENTE = ['DEUDA', 'CREDITO'] as const;

export function tienePendiente(categoriaFuncional: string): boolean {
  return (CATEGORIAS_CON_PENDIENTE as readonly string[]).includes(categoriaFuncional);
}

/**
 * Política "Derivar estado operativo" (DDD Sección W): tras cualquier impacto que
 * mueva el `valor_vigente` de una DEUDA/CREDITO, el `valor_pendiente` se
 * re-deriva como su valor absoluto — se mantiene el invariante
 * `valor_pendiente == |valor_vigente|` (GAPS.md G17).
 *
 * Es una política muda y 1-a-1: NO escribe entrada de auditoría propia, se
 * registra implícita bajo el comando que la disparó (DDD Sección U).
 * Llamar dentro de la transacción del comando, después de actualizar
 * `valor_vigente`.
 */
export async function derivarValorPendiente(
  tx: Prisma.TransactionClient,
  elementoId: string,
): Promise<void> {
  const el = await tx.elemento_patrimonial.findUniqueOrThrow({ where: { id: elementoId } });
  if (!tienePendiente(el.categoria_funcional)) return;
  const nuevo = new Prisma.Decimal(el.valor_vigente).abs();
  const actual = el.valor_pendiente ?? new Prisma.Decimal(-1);
  if (!nuevo.equals(actual)) {
    await tx.elemento_patrimonial.update({
      where: { id: elementoId },
      data: { valor_pendiente: nuevo },
    });
  }
}
