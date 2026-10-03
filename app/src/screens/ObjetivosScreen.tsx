import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ObjetivoFinancieroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { Ayuda, Button, EmptyState, ErrorText, etiqueta, GoalCard, Skeleton, Screen } from '../ui';

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

  const nueva = () => nav.go('NuevaMeta');
  const hay = (objetivos?.length ?? 0) > 0;

  return (
    <Screen onRefresh={cargar} pie={hay ? <Button title="Nueva meta" onPress={nueva} /> : undefined}>
      <Ayuda>Plata que juntas para algo concreto.</Ayuda>

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
        (() => {
          const enProgreso = objetivos.filter((o) => o.estado === 'EN_PROGRESO');
          const monedas = new Set(enProgreso.map((o) => o.moneda));
          const meta = enProgreso.reduce((s, o) => s + o.montoObjetivo, 0);
          const avance = enProgreso.reduce((s, o) => s + o.progreso, 0);
          const pct = meta > 0 ? Math.round((avance / meta) * 100) : 0;
          return enProgreso.length > 1 && monedas.size === 1 ? (
            <GoalCard
              name={`Avance total · ${enProgreso.length} metas activas`}
              hint={`${pct}%`}
              pct={pct}
              footLeft={`${money(avance, [...monedas][0])} de ${money(meta, [...monedas][0])}`}
            />
          ) : null;
        })()
      )}

      {objetivos !== null &&
        objetivos.length > 0 &&
        objetivos.map((o) => (
          <GoalCard
            key={o.id}
            name={o.hogarId ? `${o.nombre} · hogar` : o.nombre}
            hint={`${o.progresoPorcentaje}%`}
            pct={o.progresoPorcentaje}
            ok={o.estado === 'COMPLETADO' || o.progresoPorcentaje >= 100}
            footLeft={`${money(o.progreso, o.moneda)} de ${money(o.montoObjetivo, o.moneda)}`}
            footRight={etiqueta(o.estado)}
            accion={
              o.estado === 'EN_PROGRESO' && o.puedoModificar
                ? { label: 'Ahorrar', onPress: () => nav.go('Ahorrar', { objetivoId: o.id }) }
                : undefined
            }
            onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
          />
        ))}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
