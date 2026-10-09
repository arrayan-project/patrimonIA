/**
 * Etiquetas legibles para los enums del dominio (F1 del backlog de UI/UX).
 * Las claves son los valores tal cual llegan del backend (SCREAMING_SNAKE, o el
 * texto libre del `tipo` de un elemento). `etiqueta()` cae en `humanizar()` para
 * cualquier valor que no esté acá, así nunca se muestra un `EN_PROGRESO` crudo.
 */
const DICCIONARIO: Record<string, string> = {
  // Categoría funcional del elemento patrimonial
  LIQUIDEZ: 'Liquidez',
  // RESERVA es el fondo de emergencia; "Reserva" a secas se confundía con la plata
  // apartada para metas (G32 H-01).
  RESERVA: 'Ahorro / fondo de emergencia',
  INVERSION: 'Inversión',
  ACTIVO: 'Activo',
  CREDITO: 'Crédito por cobrar',
  DEUDA: 'Deuda',

  // Naturaleza de una deuda/crédito (§G28)
  FINANCIERA: 'Financiera',
  CUSTODIA_INFORMAL: 'Encargo o custodia',

  // Tipo de evento financiero
  INGRESO: 'Ingreso',
  GASTO: 'Gasto',
  TRANSFERENCIA: 'Transferencia',
  CONVERSION: 'Conversión de moneda',
  PRESTAMO: 'Préstamo',
  SALDO_INICIAL: 'Saldo inicial',

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
  LIBERADA: 'Sacada de la meta',
  CONSUMIDA: 'Consumida',

  // Estado operativo de deuda/crédito (§B2)
  VIGENTE: 'Vigente',
  PARCIALMENTE_PAGADA: 'Parcialmente pagada',
  EN_MORA: 'En mora',
  SALDADA: 'Saldada',
  CONDONADA: 'Condonada',
  INCOBRABLE: 'Incobrable',
  MATERIALIZADO: 'Pago confirmado',
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

/**
 * Nombre de comando (auditoría) → frase legible para el historial de cambios.
 * Comunica la acción sin exponer el mecanismo (UX_FLOWS Flujo 3/6).
 */
const COMANDOS_AUDITORIA: Record<string, string> = {
  RegistrarElementoPatrimonial: 'La agregó',
  ActualizarDatosElementoPatrimonial: 'Cambió los datos',
  CorregirDatosElementoPatrimonial: 'Corrigió los datos (estaban mal)',
  CambiarVisibilidadElementoPatrimonial: 'Cambió lo que comparte',
  CambiarParticipacionEnConsolidacion: 'Cambió si suma al hogar',
  CambiarPropiedadElementoPatrimonial: 'Cambió de quién es',
  DesactivarElementoPatrimonial: 'La desactivó',
  ReactivarElementoPatrimonial: 'La reactivó',
  EliminarElementoPatrimonial: 'La eliminó',
  CondonarDeuda: 'Le perdonaron la deuda',
  DeclararIncobrable: 'Ya no espera que le paguen',
  CrearObjetivoFinanciero: 'Creó la meta',
  ActualizarDatosObjetivoFinanciero: 'Actualizó la meta',
  CambiarEstadoObjetivoFinanciero: 'Cambió el estado',
  CompletarObjetivo: 'La meta se completó',
  EliminarObjetivoFinanciero: 'Eliminó la meta',
  CrearAsignacion: 'Creó el ahorro',
  ActualizarDatosAsignacion: 'Actualizó el ahorro',
  CambiarAsociacionAObjetivo: 'Cambió la meta asociada',
  EliminarAsignacion: 'Eliminó el ahorro',
  CrearReserva: 'Ahorró',
  AjustarMontoReserva: 'Ajustó el monto ahorrado',
  LiberarReserva: 'Sacó plata de la meta',
  DefinirVisibilidadElementoPatrimonial: 'Cambió lo que comparte',
  CambiarAdmiteValorizacion: 'Cambió si cambia de valor',
  RegistrarPlataDeOtraPersona: 'Anotó plata de otra persona',
  RegistrarEventoFinanciero: 'Anotó un movimiento',
  CorregirEventoFinanciero: 'Cambió un movimiento',
  AnularEventoFinanciero: 'Eliminó un movimiento',
  RegistrarValorizacion: 'Actualizó cuánto vale',
  CorregirValorizacion: 'Corrigió un valor',
  AnularValorizacion: 'Eliminó un cambio de valor',
  RegistrarAjustePatrimonial: 'Corrigió el saldo',
  CorregirAjustePatrimonial: 'Cambió una corrección de saldo',
  AnularAjustePatrimonial: 'Eliminó una corrección de saldo',
  AhorrarParaObjetivo: 'Ahorró para la meta',
  DefinirDesignadosObjetivo: 'Cambió quiénes la manejan',
};

/**
 * Glosario de la UI (G32 H-01/H-13; D-4 de G33). En pantalla se habla de "Meta",
 * "Ahorrar" y "en la meta"; Objetivo, Asignación y Reserva quedan como términos
 * internos del dominio.
 */
export const GLOSARIO = {
  apartado:
    'Ahorrar para una meta separa plata de una cuenta. No sale de la cuenta: sigue ahí, pero queda en la meta y no cuenta como libre para gastar.',
  valorizar:
    'Una valorización actualiza cuánto vale hoy un bien o inversión (precio de mercado, tasación). No es un movimiento de dinero. El nuevo valor reemplaza al vigente —no se suma— y el cambio queda en el historial.',
  ajuste:
    'Un ajuste corrige el valor cuando no puedes reconstruir la causa exacta de una diferencia (el saldo del banco no cuadra con lo registrado, un error viejo). Si sabes qué pasó, registra el movimiento en su lugar.',
} as const;

/** Frase legible de una acción de auditoría (cae al humanizado del comando). */
export function accionAuditoria(comando: string): string {
  // Sin frase propia: "RegistrarPlataDeOtraPersona" → "Registrar plata de otra persona".
  return COMANDOS_AUDITORIA[comando] ?? humanizar(comando.replace(/([a-z])([A-Z])/g, '$1_$2'));
}

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
