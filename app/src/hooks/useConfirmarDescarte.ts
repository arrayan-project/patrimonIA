import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { confirmar } from '../ui/confirmar';

/**
 * Intercepta el "atrás" (gesto, flecha del header, botón físico de Android)
 * mientras hay cambios sin guardar y pide confirmar el descarte.
 *
 * - `hayCambios`: pasar `true` cuando el formulario tiene datos que se perderían.
 * - Devuelve `permitirSalida()`: llamar justo antes de `nav.back()` tras guardar
 *   con éxito, para que no aparezca el diálogo al salir.
 */
export function useConfirmarDescarte(hayCambios: boolean): () => void {
  const navigation = useNavigation();
  const sucio = useRef(hayCambios);
  const permitido = useRef(false);
  sucio.current = hayCambios;

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (permitido.current || !sucio.current) return;
        e.preventDefault();
        confirmar(
          '¿Descartar los cambios?',
          'Si vuelves atrás ahora, se pierde lo que escribiste.',
          'Descartar',
        ).then((ok) => {
          if (ok) {
            permitido.current = true;
            navigation.dispatch(e.data.action);
          }
        });
      }),
    [navigation],
  );

  return () => {
    permitido.current = true;
  };
}
