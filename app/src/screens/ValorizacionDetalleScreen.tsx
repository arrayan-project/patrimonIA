import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import { AccionDestructiva, Dato, Datos, ErrorText, fechaLegible, Hero, Migaja, Nota, Screen, Skeleton } from '../ui';

export function ValorizacionDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const valorizacionId = nav.route.params?.valorizacionId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;

  const [val, setVal] = useState<ValorizacionDTO | null>(null);
  const [esUltimaVigente, setEsUltimaVigente] = useState(false);
  const [corregida, setCorregida] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<ValorizacionDTO[]>(
        `/elementos-patrimoniales/${elementoId}/valorizaciones`,
        token,
      );
      setVal(lista.find((x) => x.id === valorizacionId) ?? null);
      setEsUltimaVigente(lista.filter((x) => !x.anulada)[0]?.id === valorizacionId);
      setCorregida(lista.some((x) => !x.anulada && x.correccionDeId === valorizacionId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, valorizacionId, token]);

  useCargaAlEnfocar(cargar);

  // G11: cualquier valorización vigente, no solo la última; si ya tiene una
  // corrección vigente, se actúa sobre la corrección.
  const accionable = !!val && !val.anulada && val.correccionDeId === null && !corregida;

  useAccionHeader(
    'Corregir',
    accionable && val
      ? () => nav.go('CorreccionForm', { tipo: 'valorizacion', id: valorizacionId, montoActual: val.valorNuevo, moneda })
      : undefined,
  );

  if (!val) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Hero
        label={val.anulada ? 'Valorización eliminada' : 'Nuevo valor'}
        value={money(val.valorNuevo, moneda)}
        substats={[{ label: 'Antes', value: money(val.valorAnterior, moneda) }]}
      />
      <Datos>
        <Dato etiqueta="Fecha" valor={fechaLegible(val.fecha)} />
        <Dato etiqueta="Estado" valor={val.anulada ? 'Eliminada' : 'Vigente'} />
      </Datos>
      {val.correccionDeId && <Nota>Es la corrección de una valorización anterior.</Nota>}
      {corregida && !val.anulada && <Nota>Esta valorización ya fue corregida.</Nota>}
      <ErrorText>{error}</ErrorText>
      {accionable && (
        <AccionDestructiva
          title="Eliminar valorización"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar valorización',
              explicacion: esUltimaVigente
                ? 'El valor del elemento se descuenta en lo que subió o bajó con esta valorización.'
                : 'El valor actual no cambia (lo fija una valorización posterior); se recalcula el historial entre ambas.',
              pregunta: '¿Por qué la eliminas?',
              boton: 'Eliminar valorización',
              comando: 'AnularValorizacion',
              body: { valorizacionId },
              aviso: 'Valorización eliminada',
              peligro: true,
              volver: 2,
            })
          }
        />
      )}
    </Screen>
  );
}
