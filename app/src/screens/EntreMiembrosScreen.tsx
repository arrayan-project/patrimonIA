import { useCallback, useState } from 'react';
import { ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { cargarEntreMiembros, type EntreMiembros } from '../entreMiembros';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useNav, useTitulo } from '../navigation/navigator';
import { EmptyState, ErrorText, ListCard, Nota, Screen, Section, Skeleton, TxRow } from '../ui';
import type { FilaEntre } from '../solicitudes';

/** Una fila de "Entre [miembro] y tú": abre el pago si te toca, o el movimiento. */
export function FilaEntreRow({ f }: { f: FilaEntre }) {
  const nav = useNav();
  const onPress = f.solicitudId
    ? () => nav.go('PagarSolicitud', { solicitudId: f.solicitudId })
    : f.eventoId
      ? () => nav.go('MovimientoDetalle', { eventoId: f.eventoId })
      : undefined;
  return (
    <TxRow
      title={f.titulo}
      subtitle={f.detalle}
      amount={f.monto}
      positivo={f.positivo}
      logo={{ emoji: f.emoji }}
      onPress={onPress}
    />
  );
}

/**
 * HZ-21 — "Entre [miembro] y tú" completo (plantilla Lista): solicitudes en las
 * dos direcciones y transferencias entre ustedes de los últimos 30 días. Solo
 * lectura; no reabre la atribución del gasto por persona.
 */
export function EntreMiembrosScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const hogarId = nav.route.params?.hogarId as string;
  const [datos, setDatos] = useState<EntreMiembros | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(await cargarEntreMiembros(token, usuario.id, hogarId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, usuario.id, hogarId]);
  useCargaAlEnfocar(cargar);
  useTitulo(datos?.titulo ?? 'Entre ustedes');

  return (
    <Screen onRefresh={cargar}>
      {datos === null ? (
        <Skeleton />
      ) : datos.filas.length === 0 ? (
        <EmptyState
          emoji="🤝"
          titulo="Nada entre ustedes todavía"
          descripcion="Aquí aparece lo que se piden y lo que se transfieren."
        />
      ) : (
        <>
          {(['toca', 'espera', 'resuelto'] as const).map((g) => {
            const filas = datos.filas.filter((f) => f.grupo === g);
            if (filas.length === 0) return null;
            const titulo =
              g === 'toca'
                ? '⏰ Te toca'
                : g === 'espera'
                  ? datos.otros.length === 1
                    ? `⏳ Esperando a ${datos.otros[0].nombre}`
                    : '⏳ Esperando que te paguen'
                  : '✅ Ya resuelto';
            return (
              <Section key={g} title={titulo}>
                <ListCard>
                  {filas.map((f) => (
                    <FilaEntreRow key={f.key} f={f} />
                  ))}
                </ListCard>
              </Section>
            );
          })}
          <Nota>🗓️ Las transferencias, de los últimos 30 días.</Nota>
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
