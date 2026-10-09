import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ObjetivoFinancieroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { cuantoFalta, money, porcentaje } from '../format';
import { emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { Button, EmptyState, ErrorText, GoalCard, Skeleton, Screen } from '../ui';

/**
 * G35: la tarjeta de una meta (Planificar y Metas): su emoji, si es del hogar,
 * el avance y, al pie, cuánto falta para la fecha o cómo terminó.
 */
export function TarjetaMeta({ o, ahorrar }: { o: ObjetivoFinancieroDTO; ahorrar?: boolean }) {
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const lista = o.estado === 'COMPLETADO' || o.progresoPorcentaje >= 100;
  const pie =
    o.estado === 'CANCELADO'
      ? '❌ Cancelada'
      : lista
        ? '✅ ¡Lista!'
        : o.fechaObjetivo
          ? `⏳ ${cuantoFalta(o.fechaObjetivo)}`
          : undefined;
  return (
    <GoalCard
      name={o.nombre}
      emoji={emojiMeta(o.id, preferencias.emojis.metas)}
      tag={o.hogarId ? '👥 Del hogar' : undefined}
      hint={porcentaje(o.progresoPorcentaje)}
      pct={o.progresoPorcentaje}
      ok={lista}
      footLeft={`${money(o.progreso, o.moneda)} de ${money(o.montoObjetivo, o.moneda)}`}
      footRight={pie}
      accion={
        ahorrar && o.estado === 'EN_PROGRESO' && o.puedoModificar
          ? { label: '🐷 Ahorrar', onPress: () => nav.go('Ahorrar', { objetivoId: o.id }) }
          : undefined
      }
      onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
    />
  );
}

export function ObjetivosScreen() {
  const { token } = useSession();
  const nav = useNav();
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setObjetivos(await api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const nueva = () => nav.go('MetaForm');
  const hay = (objetivos?.length ?? 0) > 0;

  return (
    <Screen onRefresh={cargar} pie={hay ? <Button title="🎯 Nueva meta" onPress={nueva} /> : undefined}>
      {objetivos === null ? (
        <Skeleton />
      ) : objetivos.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          titulo="Aún no tienes metas"
          descripcion="Ponle nombre y monto, y después ahorra para ella."
          accion="Crear la primera"
          onAccion={nueva}
        />
      ) : (
        objetivos.map((o) => <TarjetaMeta key={o.id} o={o} ahorrar />)
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
