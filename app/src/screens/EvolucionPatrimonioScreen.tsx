import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, ApiError, type SeriePatrimonialDTO, type VariacionPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { usePreferencias } from '../preferencias';
import { emojiMoneda } from '../emojis';
import { aISO, CambioPeriodo, Dato, Datos, ErrorText, fechaLegible, Hero, Nota, Screen, Section, Segmented, Skeleton } from '../ui';
import { GraficoLinea } from '../ui/charts';

const PERIODOS = ['3M', '6M', '1A', '3A'] as const;
type Periodo = (typeof PERIODOS)[number];
const MESES: Record<Periodo, number> = { '3M': 3, '6M': 6, '1A': 12, '3A': 36 };
const NOMBRE: Record<Periodo, string> = { '3M': '3 meses', '6M': '6 meses', '1A': '1 año', '3A': '3 años' };
const HACE: Record<Periodo, string> = { '3M': 'Hace 3 meses', '6M': 'Hace 6 meses', '1A': 'Hace un año', '3A': 'Hace 3 años' };

/**
 * ¿Cómo ha cambiado tu plata? (plantilla Resumen, R6): una cifra — cuánto
 * tienes hoy — con el gráfico y, debajo, la resta que cuadra (antes → hoy =
 * subió / bajó). Sin campos de fecha: el período se elige con un toque.
 */
export function EvolucionPatrimonioScreen() {
  const { token } = useSession();
  const { preferencias } = usePreferencias();
  const [periodo, setPeriodo] = useState<Periodo>('6M');
  const [data, setData] = useState<VariacionPatrimonialDTO | null>(null);
  const [serie, setSerie] = useState<SeriePatrimonialDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    const d = new Date();
    d.setMonth(d.getMonth() - MESES[periodo]);
    const q = `desde=${aISO(d)}`;
    setData(null);
    Promise.all([
      api.get<VariacionPatrimonialDTO>(`/usuarios/me/variacion-patrimonial?${q}`, token),
      api.get<SeriePatrimonialDTO>(`/usuarios/me/serie-patrimonial?${q}&pasos=12`, token),
    ])
      .then(([v, s]) => {
        if (!vigente) return;
        setData(v);
        setSerie(s);
        setError('');
      })
      .catch((e) => vigente && setError(e instanceof ApiError ? e.message : 'Error inesperado'));
    return () => {
      vigente = false;
    };
  }, [periodo, token]);

  const principal =
    data?.porMoneda.find((m) => m.moneda === preferencias.monedaPreferida) ?? data?.porMoneda[0] ?? null;
  const otras = data?.porMoneda.filter((m) => m !== principal) ?? [];

  return (
    <Screen>
      <Segmented options={PERIODOS} value={periodo} onChange={setPeriodo} formatearOpcion={(v) => NOMBRE[v]} />

      {!data ? (
        error ? <ErrorText>{error}</ErrorText> : <Skeleton filas={2} />
      ) : !principal ? (
        <Nota>Aún no hay datos para este período.</Nota>
      ) : (
        <>
          <Hero
            label="Tu plata en total hoy"
            value={money(principal.patrimonioHasta, principal.moneda)}
            debajo={
              <CambioPeriodo
                etiquetaAntes={`🗓️ ${HACE[periodo]}`}
                antes={principal.patrimonioDesde}
                hoy={principal.patrimonioHasta}
                formato={(n) => money(n, principal.moneda)}
              />
            }
          >
            {serie && serie.puntos.length >= 2 ? (
              <View style={{ marginTop: 8 }}>
                <GraficoLinea
                  puntos={serie.puntos.map((p) => ({
                    etiqueta: fechaLegible(p.fecha),
                    valor: p.porMoneda.find((m) => m.moneda === principal.moneda)?.patrimonio ?? 0,
                  }))}
                />
              </View>
            ) : null}
          </Hero>

          {otras.length > 0 && (
            <Section title="💱 En otras monedas">
              <Datos>
                {otras.map((m) => (
                  <Dato
                    key={m.moneda}
                    etiqueta={`${emojiMoneda(m.moneda)} ${money(m.patrimonioHasta, m.moneda)}`}
                    valor={
                      m.variacion === 0
                        ? 'Sin cambios'
                        : `${m.variacion > 0 ? '📈 Subió' : '📉 Bajó'} ${money(Math.abs(m.variacion), m.moneda)}`
                    }
                  />
                ))}
              </Datos>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
