import { useEffect, useState } from 'react';
import { estadoRed, observarRed } from './client';

/** `true` mientras el backend responde; `false` tras un fallo de red. */
export function useConexion(): boolean {
  const [enLinea, setEnLinea] = useState(estadoRed);
  useEffect(() => observarRed(setEnLinea), []);
  return enLinea;
}
