import type { HttpException } from '@nestjs/common';

type HttpExceptionCtor<E extends HttpException> = new (respuesta?: string | object) => E;

/**
 * G33 (residuo de D-4) — error con `codigo` estable para que la app lo traduzca
 * a su vocabulario de superficie. El cuerpo conserva `message`, `error` y
 * `statusCode` como cualquier excepción de Nest; `datos` lleva los valores que
 * el texto necesita (p. ej. el monto disponible).
 */
export function errorConCodigo<E extends HttpException>(
  Ctor: HttpExceptionCtor<E>,
  codigo: string,
  mensaje: string,
  datos?: Record<string, unknown>,
): E {
  const base = new Ctor(mensaje).getResponse() as object;
  return new Ctor({ ...base, codigo, ...(datos ? { datos } : {}) });
}
