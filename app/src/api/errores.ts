/**
 * G33 (residuo de D-4) — traduce los errores del backend que traen `codigo` al
 * vocabulario de superficie (Meta, Ahorro, Cuenta…). Sin código, o con uno
 * desconocido, se muestra el mensaje del backend tal cual.
 */
const MENSAJES: Record<string, (d: Record<string, unknown>) => string> = {
  OBJETIVO_NO_ENCONTRADO: () => 'No encontramos esa meta.',
  OBJETIVO_AJENO: () => 'Esa meta no es tuya.',
  OBJETIVO_NO_MODIFICABLE: () => 'No puedes modificar esta meta. Pídele a quien la creó que te agregue.',
  OBJETIVO_NO_COMPARTIDO: () => 'Esta meta no está compartida con el hogar.',
  OBJETIVO_MISMO_ESTADO: () => 'La meta ya está en ese estado.',
  OBJETIVO_SOLO_DUENO: () => 'Solo quien creó la meta puede hacer esto.',
  PRESUPUESTO_META_REPETIDA: () => 'Hay una meta repetida en el presupuesto.',
  PRESUPUESTO_META_INVALIDA: () => 'Una de las metas ya no existe o no es parte de este presupuesto.',
  ASIGNACION_NO_ENCONTRADA: () => 'No encontramos esa parte de la meta.',
  ASIGNACION_AJENA: () => 'No puedes usar esa parte de la meta.',
  RESERVA_NO_ENCONTRADA: () => 'No encontramos ese ahorro.',
  RESERVA_NO_ACTIVA: () => 'Ese ahorro ya no está en la meta.',
  ELEMENTO_CON_RESERVAS: () => 'Esta cuenta tiene plata en metas. Sácala de las metas primero.',
  DISPONIBLE_INSUFICIENTE: (d) =>
    typeof d.disponible === 'number'
      ? `La cuenta solo tiene $${Math.max(0, d.disponible).toLocaleString('es-CL')} libre para esto.`
      : 'La cuenta no tiene suficiente plata libre.',
  ORIGEN_IGUAL_DESTINO: () => 'La cuenta de salida y la de llegada no pueden ser la misma.',
  MONEDAS_IGUALES: () => 'Elige dos monedas distintas.',
  ORIGEN_AJENO: () => 'Esa cuenta no es tuya.',
  DESTINO_NO_PERMITIDO: () =>
    'No puedes transferir a esa cuenta. Su dueño tiene que compartirla con "Que puedan transferirte".',
  YA_ANULADO: () => 'Esto ya estaba anulado.',
  CORREGIR_ANULADO: () => 'No se puede corregir algo que está anulado.',
  FALTA_CUENTA: () => 'Falta elegir la cuenta.',
  META_SIN_CUENTA: () => 'Elige en qué cuenta se guarda la plata de la meta.',
  MONEDA_DISTINTA: () => 'Todas las cuentas tienen que estar en la moneda de la meta.',
  ORIGEN_REPETIDO: () => 'Elegiste la misma cuenta dos veces.',
};

export function traducirError(codigo: unknown, datos: unknown, mensaje: string): string {
  const f = typeof codigo === 'string' ? MENSAJES[codigo] : undefined;
  return f ? f(datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {}) : mensaje;
}
