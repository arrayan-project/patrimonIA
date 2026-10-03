import { Fragment, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type EventoConsolidadoDTO, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  EmptyState,
  ErrorText,
  etiqueta,
  fechaLegible,
  ListCard,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
  tipoDe,
  type Paleta,
} from '../ui';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const NEUTRO = new Set(['TRANSFERENCIA', 'CONVERSION']);

const iconoTipo = (tipo: string) =>
  tipo === 'INGRESO' || tipo === 'SALDO_INICIAL'
    ? ('arrow-down-outline' as const)
    : tipo === 'GASTO'
      ? ('arrow-up-outline' as const)
      : ('swap-horizontal-outline' as const);

/**
 * Actividad financiera del hogar (REQUISITES §K / línea 213): una fila por evento
 * —la transferencia colapsada a un solo movimiento—, filtrada por §M a lo que el
 * actor puede ver (elementos consolidados del hogar o propios).
 */
export function MovimientosHogarScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const paramHogar = nav.route.params?.hogarId as string | undefined;

  const [hogarId, setHogarId] = useState<string | null>(paramHogar ?? null);
  const [eventos, setEventos] = useState<EventoConsolidadoDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      let hid = hogarId;
      if (!hid) {
        const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        hid = hs[0]?.id ?? null;
        setHogarId(hid);
      }
      if (!hid) {
        setEventos([]);
        return;
      }
      const evs = await api.get<EventoConsolidadoDTO[]>(`/hogares/${hid}/eventos-financieros`, token);
      setEventos(evs.filter((e) => !e.anulado));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [hogarId, token]);

  useCargaAlEnfocar(cargar);

  const porMes = useMemo(() => {
    const grupos = new Map<string, EventoConsolidadoDTO[]>();
    for (const e of eventos ?? []) {
      const k = e.fecha.slice(0, 7);
      grupos.set(k, [...(grupos.get(k) ?? []), e]);
    }
    return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [eventos]);

  return (
    <Screen onRefresh={cargar}>
      <Text style={styles.muted}>
        Ingresos, gastos y transferencias sobre el patrimonio consolidado y tus cuentas. Los
        movimientos privados de otros miembros no aparecen.
      </Text>

      {eventos === null ? (
        <Skeleton filas={4} />
      ) : eventos.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          titulo="Sin movimientos del hogar"
          descripcion="Cuando alguien registre un ingreso, gasto o transferencia sobre una cuenta consolidada, lo verás acá."
        />
      ) : (
        porMes.map(([mes, lista]) => {
          const [anio, m] = mes.split('-');
          return (
            <Fragment key={mes}>
              <Section title={`${MESES[Number(m) - 1]} ${anio}`}>
                <ListCard>
                  {lista.map((e) => {
                    const neutro = NEUTRO.has(e.tipo);
                    const signo = e.tipo === 'GASTO' ? '−' : neutro ? '' : '+';
                    const subtitle = neutro
                      ? `${e.elementos.map((x) => x.nombre).join(' → ') || 'Transferencia interna'} · ${fechaLegible(e.fecha)}`
                      : `${etiqueta(e.tipo)} · ${e.elementos[0]?.nombre ?? ''} · ${fechaLegible(e.fecha)}`;
                    return (
                      <TxRow
                        key={e.eventoId}
                        title={e.glosa || (neutro ? 'Transferencia' : etiqueta(e.tipo))}
                        subtitle={`${subtitle}${e.corregido ? ' · corregido' : ''}`}
                        amount={`${signo}${money(e.montoEfectivo, e.moneda)}`}
                        positivo={!neutro && (e.tipo === 'INGRESO' || e.tipo === 'SALDO_INICIAL')}
                        logo={{ icon: iconoTipo(e.tipo) }}
                        onPress={() => nav.go('MovimientoDetalle', { eventoId: e.eventoId })}
                      />
                    );
                  })}
                </ListCard>
              </Section>
            </Fragment>
          );
        })
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    muted: tipoDe(c).nota,
  });
