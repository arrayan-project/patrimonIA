import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Ejecuta `cargar` cada vez que la pantalla toma el foco (al abrirla y al volver
 * a ella desde otra). Reemplaza el `useEffect(() => cargar(), [cargar])` que solo
 * corría una vez — así los cambios hechos en pantallas hijas se reflejan sin
 * apretar "Actualizar".
 *
 * `cargar` DEBE venir memoizado con `useCallback` (como ya estaba).
 */
export function useCargaAlEnfocar(cargar: () => void | Promise<void>): void {
  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );
}
