import { useEffect, useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO, type ValorHistoricoElementoDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useNav } from '../navigation/navigator';
import { aISO, CambioPeriodo, DateField, ErrorText, fechaLegible, Nota, Panel, Screen, Segmented, Skeleton } from '../ui';

const OPCIONES = ['1M', '6M', '1A', 'OTRA'] as const;
type Opcion = (typeof OPCIONES)[number];
const NOMBRE: Record<Opcion, string> = { '1M': '1 mes', '6M': '6 meses', '1A': '1 año', OTRA: '📅 Otra' };
const MESES: Record<Exclude<Opcion, 'OTRA'>, number> = { '1M': 1, '6M': 6, '1A': 12 };

/**
 * ¿Cuánto valía antes? (plantillas de pantalla, R3: la consulta sale del
 * Detalle, que no lleva campos). G35: se elige "hace cuánto" con un toque (u
 * otra fecha) y la respuesta aparece al tiro, como resta Entonces → Hoy. Solo
 * consulta.
 */
export function ValorEnFechaScreen() {
  const { token } = useSession();
  const nav = useNav();
  const elementoId = nav.route.params?.elementoId as string;
  const [el, setEl] = useState<ElementoPatrimonialDTO | null>(null);
  const [opcion, setOpcion] = useState<Opcion>('1M');
  const [otra, setOtra] = useState('');
  const [valor, setValor] = useState<ValorHistoricoElementoDTO | null>(null);
  const [error, setError] = useState('');

  const fecha = (() => {
    if (opcion === 'OTRA') return /^\d{4}-\d{2}-\d{2}$/.test(otra.trim()) ? otra.trim() : '';
    const d = new Date();
    d.setMonth(d.getMonth() - MESES[opcion]);
    return aISO(d);
  })();

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token)
      .then(setEl)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error inesperado'));
  }, [elementoId, token]);

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    setValor(null);
    setError('');
    api
      .get<ValorHistoricoElementoDTO>(`/elementos-patrimoniales/${elementoId}/valor-historico?fecha=${fecha}`, token)
      .then((v) => vigente && setValor(v))
      .catch((e: unknown) => vigente && setError(e instanceof ApiError ? e.message : 'Error inesperado'));
    return () => {
      vigente = false;
    };
  }, [elementoId, fecha, token]);

  // En una deuda se habla de lo que se debe (en positivo).
  const deuda = el?.categoriaFuncional === 'DEUDA';
  const ver = (n: number) => (deuda ? -n : n);

  return (
    <Screen>
      <Segmented
        label="¿Hace cuánto?"
        options={OPCIONES}
        value={opcion}
        onChange={(o) => {
          setOpcion(o);
          setValor(null);
        }}
        formatearOpcion={(o) => NOMBRE[o]}
      />
      {opcion === 'OTRA' && <DateField label="¿Qué fecha?" value={otra} onChange={setOtra} />}

      {!fecha ? null : !valor || !el ? (
        error ? null : <Skeleton filas={2} />
      ) : valor.existia ? (
        <Panel>
          <CambioPeriodo
            etiquetaAntes={`🗓️ ${deuda ? 'Debías' : 'Valía'} el ${fechaLegible(valor.fecha)}`}
            etiquetaAhora={deuda ? '📍 Hoy debes' : '📍 Hoy'}
            antes={ver(valor.valor)}
            hoy={ver(el.valorVigente)}
            formato={(n) => money(n, valor.moneda)}
            subirEsMalo={deuda}
          />
        </Panel>
      ) : (
        <Nota>🤷 El {fechaLegible(valor.fecha)} todavía no estaba en tu plata (o ya había salido).</Nota>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
