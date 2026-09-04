import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { observarRed } from '../api/client';

/**
 * Ejecuta `cargar` cada vez que la pantalla toma el foco (al abrirla y al volver
 * a ella desde otra). Reemplaza el `useEffect(() => cargar(), [cargar])` que solo
 * corría una vez — así los cambios hechos en pantallas hijas se reflejan sin
 * apretar "Actualizar".
 *
 * Además, si vuelve la conexión mientras la pantalla está enfocada, reintenta
 * la carga sola (E7).
 *
 * `cargar` DEBE venir memoizado con `useCallback` (como ya estaba).
 */
export function useCargaAlEnfocar(cargar: () => void | Promise<void>): void {
  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const enfocado = useIsFocused();
  const enfocadoRef = useRef(enfocado);
  enfocadoRef.current = enfocado;

  useEffect(
    () =>
      observarRed((hayRed) => {
        if (hayRed && enfocadoRef.current) void cargar();
      }),
    [cargar],
  );
}
