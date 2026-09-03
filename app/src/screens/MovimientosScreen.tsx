import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, ErrorText, GroupLabel, MenuLink, Screen, Title } from '../ui';

/** Tab "Movimientos": registrar y planificar el flujo de dinero. */
export function MovimientosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [hayElementos, setHayElementos] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const els = await api.get<ElementoPatrimonialDTO[]>(
        '/elementos-patrimoniales?propietario=me',
        token,
      );
      setHayElementos(els.length > 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  return (
    <Screen onRefresh={cargar}>
      <Title>Movimientos</Title>

      {hayElementos ? (
        <Button title="Registrar movimiento" onPress={() => nav.go('RegistrarMovimiento')} />
      ) : (
        <MenuLink
          title="Agregar tu primera cuenta"
          subtitle="Necesitas una cuenta o bien antes de registrar movimientos"
          onPress={() => nav.go('AgregarElemento')}
        />
      )}

      <GroupLabel>Planificación</GroupLabel>
      <MenuLink
        title="Plantillas de movimiento"
        subtitle="Moldes para el gasto o ingreso de siempre"
        onPress={() => nav.go('Plantillas')}
      />
      <MenuLink
        title="Presupuestos"
        subtitle="Cuánto esperas ingresar y gastar, con seguimiento por rubro"
        onPress={() => nav.go('Presupuestos')}
      />
      <MenuLink
        title="Movimientos programados"
        subtitle="Ingresos futuros con fecha, listos para materializar"
        onPress={() => nav.go('MovimientosProgramados')}
      />

      <GroupLabel>Seguimiento</GroupLabel>
      <MenuLink
        title="Evolución de mi patrimonio"
        subtitle="Variación entre dos fechas"
        onPress={() => nav.go('EvolucionPatrimonio')}
      />
      <MenuLink
        title="Tipos de cambio"
        subtitle="Tasas para convertir entre monedas"
        onPress={() => nav.go('TiposCambio')}
      />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
