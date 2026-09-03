/**
 * Etiquetas legibles para los enums del dominio (F1 del backlog de UI/UX).
 * Las claves son los valores tal cual llegan del backend (SCREAMING_SNAKE, o el
 * texto libre del `tipo` de un elemento). `etiqueta()` cae en `humanizar()` para
 * cualquier valor que no esté acá, así nunca se muestra un `EN_PROGRESO` crudo.
 */
const DICCIONARIO: Record<string, string> = {
  // Categoría funcional del elemento patrimonial
  LIQUIDEZ: 'Liquidez',
  RESERVA: 'Reserva',
  INVERSION: 'Inversión',
  ACTIVO: 'Activo',
  CREDITO: 'Crédito por cobrar',
  DEUDA: 'Deuda',

  // Tipo de evento financiero
  INGRESO: 'Ingreso',
  GASTO: 'Gasto',
  TRANSFERENCIA: 'Transferencia',
  CONVERSION: 'Conversión de moneda',
  PRESTAMO: 'Préstamo',

  // tipo_aplicable de una categoría de movimiento
  AMBOS: 'Ingresos y gastos',

  // Ámbito del elemento
  PERSONAL: 'Personal',
  HOGAR: 'Del hogar',

  // Visibilidad del elemento
  PRIVADA: 'Privada',
  COMPARTIDA: 'Compartida',
  FAMILIAR: 'Familiar',

  // Estados
  ACTIVA: 'Activa',
  ARCHIVADA: 'Archivada',
  INACTIVO: 'Inactivo',
  DESACTIVADO: 'Desactivado',
  SALIDA: 'Fuera del hogar',
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
  LIBERADA: 'Liberada',
  CONSUMIDA: 'Consumida',
  MATERIALIZADO: 'Materializado',
  CERRADO: 'Cerrado',

  // Rol en el hogar
  ADMINISTRADOR: 'Administrador',
  MIEMBRO: 'Miembro',

  // Presupuesto
  INDIVIDUAL: 'Individual',
  PERIODICO: 'Periódico',
  ESPECIFICO: 'Específico',
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',

  // Tipos de elemento sugeridos (texto libre en minúsculas)
  cuenta_corriente: 'Cuenta corriente',
  cuenta_vista: 'Cuenta vista',
  cuenta_ahorro: 'Cuenta de ahorro',
  deposito_plazo: 'Depósito a plazo',
  fondo_mutuo: 'Fondo mutuo',
  efectivo: 'Efectivo',
  inmueble: 'Inmueble',
  vehiculo: 'Vehículo',
  apv: 'APV',
  afp: 'AFP',
};

/** `EN_PROGRESO` → "En progreso"; `cuenta_corriente` → "Cuenta corriente". */
export function humanizar(valor: string): string {
  if (!valor) return valor;
  const s = valor.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Etiqueta legible de un valor de enum (o texto libre). Vacío → "—". */
export function etiqueta(valor: string | null | undefined): string {
  if (valor == null || valor === '') return '—';
  return DICCIONARIO[valor] ?? humanizar(valor);
}

/** Presets del `tipo` de un elemento (texto libre, ver REQUISITES §D). */
export const TIPOS_ELEMENTO_SUGERIDOS = [
  'cuenta_corriente',
  'cuenta_vista',
  'cuenta_ahorro',
  'deposito_plazo',
  'fondo_mutuo',
  'apv',
  'afp',
  'efectivo',
  'inmueble',
  'vehiculo',
] as const;

/** Monedas ISO 4217 de uso frecuente. `Select` permite escribir otra. */
export const MONEDAS_FRECUENTES = ['CLP', 'USD', 'EUR', 'GBP', 'ARS', 'BRL', 'PEN', 'MXN', 'COP', 'UYU'] as const;

export const NOMBRE_MONEDA: Record<string, string> = {
  CLP: 'Peso chileno',
  USD: 'Dólar estadounidense',
  EUR: 'Euro',
  GBP: 'Libra esterlina',
  ARS: 'Peso argentino',
  BRL: 'Real brasileño',
  PEN: 'Sol peruano',
  MXN: 'Peso mexicano',
  COP: 'Peso colombiano',
  UYU: 'Peso uruguayo',
};
