/**
 * Set inicial de tipos de elemento que se siembra al crear un hogar.
 * Editable / archivable. `categoriaSugerida` prellenar la categoría funcional
 * en el alta (el usuario siempre puede cambiarla).
 */
export const TIPOS_ELEMENTO_DEFAULT: {
  nombre: string;
  categoriaSugerida: 'LIQUIDEZ' | 'RESERVA' | 'INVERSION' | 'ACTIVO' | 'DEUDA' | 'CREDITO' | null;
}[] = [
  { nombre: 'Cuenta corriente', categoriaSugerida: 'LIQUIDEZ' },
  { nombre: 'Cuenta vista', categoriaSugerida: 'LIQUIDEZ' },
  { nombre: 'Cuenta de ahorro', categoriaSugerida: 'RESERVA' },
  { nombre: 'Efectivo', categoriaSugerida: 'LIQUIDEZ' },
  { nombre: 'Depósito a plazo', categoriaSugerida: 'RESERVA' },
  { nombre: 'Fondo mutuo', categoriaSugerida: 'INVERSION' },
  { nombre: 'APV', categoriaSugerida: 'INVERSION' },
  { nombre: 'Acciones', categoriaSugerida: 'INVERSION' },
  { nombre: 'Criptomonedas', categoriaSugerida: 'INVERSION' },
  { nombre: 'Propiedad', categoriaSugerida: 'ACTIVO' },
  { nombre: 'Vehículo', categoriaSugerida: 'ACTIVO' },
  { nombre: 'Crédito hipotecario', categoriaSugerida: 'DEUDA' },
  { nombre: 'Crédito de consumo', categoriaSugerida: 'DEUDA' },
  { nombre: 'Tarjeta de crédito', categoriaSugerida: 'DEUDA' },
  { nombre: 'Préstamo a un tercero', categoriaSugerida: 'CREDITO' },
];
