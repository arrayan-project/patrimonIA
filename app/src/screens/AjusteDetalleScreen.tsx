import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import { View } from 'react-native';
import { AvisoDetalle, BandaDetalle, Button, Dato, Datos, ErrorText, fechaLegible, Migaja, Nota, Screen, Skeleton, useC } from '../ui';

/** Una corrección de saldo (ajuste patrimonial, G35): cuánto y por qué, y sus acciones. */
export function AjusteDetalleScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const ajusteId = nav.route.params?.ajusteId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;
  const deuda = nav.route.params?.deuda === true;

  const [ajuste, setAjuste] = useState<AjustePatrimonialDTO | null>(null);
  const [tieneCorreccion, setTieneCorreccion] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<AjustePatrimonialDTO[]>(
        `/ajustes-patrimoniales?elemento=${elementoId}`,
        token,
      );
      setAjuste(lista.find((x) => x.id === ajusteId) ?? null);
      setTieneCorreccion(lista.some((x) => x.correccionDeId === ajusteId && !x.anulado));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, ajusteId, token]);

  useCargaAlEnfocar(cargar);

  const accionable = !!ajuste && !ajuste.anulado && ajuste.correccionDeId === null && !tieneCorreccion;


  if (!ajuste) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const interes = /inter[eé]s/i.test(ajuste.motivo);
  // En una deuda se habla de lo que se debe: un ajuste negativo es "Debes más".
  const efecto = deuda ? -ajuste.monto : ajuste.monto;
  const bueno = deuda ? efecto < 0 : efecto >= 0;
  const que = deuda ? (efecto > 0 ? 'Debes más' : 'Debes menos') : efecto >= 0 ? 'Subió el saldo' : 'Bajó el saldo';
  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      {ajuste.anulado && <AvisoDetalle color={c.danger} texto="🗑️ Esta corrección se eliminó: ya no cuenta en el saldo." />}
      <BandaDetalle
        color={bueno ? c.ok : c.danger}
        titulo={`${interes ? '💹' : '🔧'} ${que}`}
        monto={`${efecto > 0 ? '+' : efecto < 0 ? '−' : ''}${money(Math.abs(efecto), moneda)}`}
        sub={`📅 ${fechaLegible(ajuste.fecha)}`}
      />
      <Datos>
        <Dato etiqueta="📝 Por qué" valor={ajuste.motivo} />
      </Datos>
      {ajuste.correccionDeId && <Nota>✏️ Es el cambio de una corrección anterior.</Nota>}
      {tieneCorreccion && <Nota>✏️ Ya se cambió: para cambiarla otra vez, abre ese cambio.</Nota>}
      <ErrorText>{error}</ErrorText>
      {accionable && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Button
            title="✏️ Corregir"
            onPress={() => nav.go('CorreccionForm', { tipo: 'ajuste', id: ajusteId, montoActual: ajuste.monto, moneda })}
          />
          <Button
            title="🗑️ Eliminar"
            variant="danger"
            onPress={() =>
              irAAccion(nav, {
                titulo: 'Eliminar corrección de saldo',
                explicacion: 'El saldo vuelve a lo que era antes de esta corrección.',
                pregunta: '¿Por qué la eliminas?',
                boton: 'Eliminar',
                comando: 'AnularAjustePatrimonial',
                body: { ajusteId },
                aviso: 'Corrección eliminada',
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
