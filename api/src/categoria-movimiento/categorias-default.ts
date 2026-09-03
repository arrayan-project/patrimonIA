/** Set inicial que se siembra al crear un hogar (GAPS.md G23). Editable/archivable. */
export const CATEGORIAS_DEFAULT: {
  nombre: string;
  tipoAplicable: 'INGRESO' | 'GASTO' | 'AMBOS';
}[] = [
  { nombre: 'Sueldo', tipoAplicable: 'INGRESO' },
  { nombre: 'Otros ingresos', tipoAplicable: 'INGRESO' },
  { nombre: 'Mercado', tipoAplicable: 'GASTO' },
  { nombre: 'Vivienda', tipoAplicable: 'GASTO' },
  { nombre: 'Servicios', tipoAplicable: 'GASTO' },
  { nombre: 'Transporte', tipoAplicable: 'GASTO' },
  { nombre: 'Salud', tipoAplicable: 'GASTO' },
  { nombre: 'Educación', tipoAplicable: 'GASTO' },
  { nombre: 'Restaurantes', tipoAplicable: 'GASTO' },
  { nombre: 'Ocio', tipoAplicable: 'GASTO' },
  { nombre: 'Otros gastos', tipoAplicable: 'GASTO' },
];
