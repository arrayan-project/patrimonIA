import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import { View } from 'react-native';
import { AvisoDetalle, BandaDetalle, Button, CambioPeriodo, ErrorText, fechaLegible, Migaja, Nota, Screen, Skeleton, useC } from '../ui';

/** Un cambio de valor (valorización, G35): Antes → Ahora = Subió / Bajó y sus acciones. */
export function ValorizacionDetalleScreen() {
  const c = useC();
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


  if (!val) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const dif = val.valorNuevo - val.valorAnterior;
  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      {val.anulada && <AvisoDetalle color={c.danger} texto="🗑️ Este cambio se eliminó: ya no cuenta en el valor." />}
      <BandaDetalle
        color={c.primary}
        titulo={dif >= 0 ? '📈 Subió su valor' : '📉 Bajó su valor'}
        monto={money(val.valorNuevo, moneda)}
        sub={`📅 ${fechaLegible(val.fecha)}`}
      >
        <CambioPeriodo
          etiquetaAntes="⏮️ Antes"
          etiquetaAhora="✅ Después"
          antes={val.valorAnterior}
          hoy={val.valorNuevo}
          formato={(n) => money(n, moneda)}
        />
      </BandaDetalle>
      {val.correccionDeId && <Nota>✏️ Es el cambio de un valor anterior.</Nota>}
      {corregida && !val.anulada && <Nota>✏️ Este valor ya se cambió: para cambiarlo otra vez, abre ese cambio.</Nota>}
      <ErrorText>{error}</ErrorText>
      {accionable && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Button
            title="✏️ Corregir"
            onPress={() =>
              nav.go('CorreccionForm', { tipo: 'valorizacion', id: valorizacionId, montoActual: val.valorNuevo, moneda })
            }
          />
          <Button
            title="🗑️ Eliminar"
            variant="danger"
            onPress={() =>
              irAAccion(nav, {
                titulo: 'Eliminar cambio de valor',
                explicacion: esUltimaVigente
                  ? 'El valor vuelve a lo que era antes de este cambio.'
                  : 'El valor de hoy no cambia (lo fija un cambio posterior).',
                pregunta: '¿Por qué lo eliminas?',
                boton: 'Eliminar',
                comando: 'AnularValorizacion',
                body: { valorizacionId },
                aviso: 'Cambio de valor eliminado',
                peligro: true,
                volver: 2,
              })
            }
          />
        </View>
      )}
    </Screen>
  );
}
