import { useCallback, useState } from 'react';
import { api, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { colorAnotar, HojaAcciones, useC, type AccionHoja } from '../ui';
import { useCargaAlEnfocar } from './useCargaAlEnfocar';

export const TITULO_ANOTAR = '¿Qué quieres anotar?';

const esTarjeta = (e: ElementoPatrimonialDTO) =>
  e.estado === 'ACTIVO' && e.categoriaFuncional === 'DEUDA' && e.tipo.trim().toLowerCase() === 'tarjeta de crédito';

/**
 * D-8 — el menú "¿Qué quieres anotar?": una puerta por dirección de la plata
 * (de quién es se pregunta en el paso 2). Es el mismo en el "+" y en cualquier
 * botón que lleve a registrar algo. `acciones` va a un `FabMenu`; `abrir` +
 * `hoja` sirven para un botón propio.
 */
export function useAnotar() {
  const { token } = useSession();
  const nav = useNav();
  const c = useC();
  const [abierto, setAbierto] = useState(false);
  const [tarjetas, setTarjetas] = useState<ElementoPatrimonialDTO[]>([]);

  // "Pagar tarjeta" solo aparece si hay tarjeta (al volver a la pantalla se revisa de nuevo).
  const cargar = useCallback(() => {
    api
      .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
      .then((els) => setTarjetas(els.filter(esTarjeta)))
      .catch(() => setTarjetas([]));
  }, [token]);
  useCargaAlEnfocar(cargar);

  const acciones: AccionHoja[] = [
    {
      icon: 'arrow-up-outline',
      emoji: '💸',
      grande: colorAnotar(c, 'GASTO'),
      label: 'Gasté',
      subtitle: 'Compré o pagué algo',
      onPress: () => nav.go('RegistrarMovimiento', { tipo: 'GASTO' }),
    },
    {
      icon: 'arrow-down-outline',
      emoji: '💰',
      grande: colorAnotar(c, 'INGRESO'),
      label: 'Recibí',
      subtitle: 'Me llegó plata',
      onPress: () => nav.go('RegistrarMovimiento', { tipo: 'INGRESO' }),
    },
    {
      icon: 'swap-horizontal-outline',
      emoji: '🔁',
      grande: colorAnotar(c, 'TRANSFERENCIA'),
      label: 'Moví plata',
      subtitle: 'Entre tus cuentas o a alguien del hogar',
      onPress: () => nav.go('RegistrarMovimiento', { tipo: 'TRANSFERENCIA' }),
    },
    {
      icon: 'flag-outline',
      emoji: '🐷',
      label: 'Ahorrar para una meta',
      subtitle: 'Mandar plata a una meta',
      onPress: () => nav.go('Ahorrar'),
    },
    ...(tarjetas.length > 0
      ? [
          {
            icon: 'card-outline' as const,
            emoji: '💳',
            label: 'Pagar tarjeta',
            subtitle: 'Pagar lo que debes de una tarjeta',
            onPress: () =>
              nav.go('RegistrarMovimiento', {
                tipo: 'TRANSFERENCIA',
                titulo: 'Pagar tarjeta',
                ...(tarjetas.length === 1 ? { destinoId: tarjetas[0].id } : {}),
              }),
          },
        ]
      : []),
    {
      icon: 'add-circle-outline',
      emoji: '➕',
      label: 'Agregar cuenta',
      subtitle: 'Una cuenta, tarjeta, inversión, deuda o bien',
      onPress: () => nav.go('AgregarElemento'),
    },
  ];

  const hoja = (
    <HojaAcciones visible={abierto} onClose={() => setAbierto(false)} titulo={TITULO_ANOTAR} actions={acciones} />
  );
  return { acciones, abrir: () => setAbierto(true), hoja };
}
