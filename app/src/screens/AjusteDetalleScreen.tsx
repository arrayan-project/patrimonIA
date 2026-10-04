import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import { AccionDestructiva, Dato, Datos, ErrorText, fechaLegible, Hero, Migaja, Nota, Screen, Skeleton } from '../ui';

export function AjusteDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const ajusteId = nav.route.params?.ajusteId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;

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

  useAccionHeader(
    'Corregir',
    accionable && ajuste
      ? () => nav.go('CorreccionForm', { tipo: 'ajuste', id: ajusteId, montoActual: ajuste.monto, moneda })
      : undefined,
  );

  if (!ajuste) {
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
      <Hero label={ajuste.anulado ? 'Ajuste eliminado' : 'Ajuste'} value={money(ajuste.monto, moneda)} />
      <Datos>
        <Dato etiqueta="Fecha" valor={fechaLegible(ajuste.fecha)} />
        <Dato etiqueta="Motivo" valor={ajuste.motivo} />
        <Dato etiqueta="Estado" valor={ajuste.anulado ? 'Eliminado' : 'Vigente'} />
      </Datos>
      {ajuste.correccionDeId && <Nota>Es la corrección de un ajuste anterior.</Nota>}
      {tieneCorreccion && <Nota>Este ajuste ya fue corregido: corrige o elimina esa corrección.</Nota>}
      <ErrorText>{error}</ErrorText>
      {accionable && (
        <AccionDestructiva
          title="Eliminar ajuste"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar ajuste',
              explicacion: 'Se revierte el efecto del ajuste sobre el saldo. Queda en el historial.',
              pregunta: '¿Por qué lo eliminas?',
              boton: 'Eliminar ajuste',
              comando: 'AnularAjustePatrimonial',
              body: { ajusteId },
              aviso: 'Ajuste eliminado',
              peligro: true,
              volver: 2,
            })
          }
        />
      )}
    </Screen>
  );
}
