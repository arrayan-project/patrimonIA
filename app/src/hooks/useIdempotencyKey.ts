import { useCallback, useState } from 'react';

/** UUID v4 pseudo-aleatorio. Suficiente para un Idempotency-Key (no es cripto). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Devuelve una clave estable para el envío actual de un formulario y una función
 * para rotarla. Un doble-tap o un reintento de red reusan la misma clave → el
 * backend (Fase 12) devuelve la respuesta guardada en vez de crear un duplicado.
 * Tras un alta exitosa se llama `rotar()` para que el siguiente envío sea nuevo.
 */
export function useIdempotencyKey(): { key: string; rotar: () => void } {
  const [key, setKey] = useState(uuid);
  const rotar = useCallback(() => setKey(uuid()), []);
  return { key, rotar };
}
