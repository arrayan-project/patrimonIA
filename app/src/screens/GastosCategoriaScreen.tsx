import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type MovimientoReporteDTO, type ResumenFinancieroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { nombreDia } from './MovimientosScreen';
import { Dato, Datos, ErrorText, ListCard, Nota, Screen, Section, Skeleton, TxRow, useC } from '../ui';
import { Text } from '../ui/Text';

/**
 * G35 (Juan, 2026-10-09): los gastos de una categoría en el período de un
 * presupuesto, encima del presupuesto (con "atrás"), en vez de saltar a la
 * pestaña Movimientos. `categoriaId` null = sin categoría. También se abre
 * desde el detalle de un movimiento (su mes); con `tipo` INGRESO muestra lo
 * que entró en una categoría de ingresos.
 */
export function GastosCategoriaScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const p = nav.route.params ?? {};
  const categoriaId = (p.categoriaId as string | null | undefined) ?? null;
  const nombre = p.nombre as string;
  const emoji = p.emoji as string;
  const periodo = p.periodo as string;
  const desde = p.desde as string;
  const hasta = p.hasta as string;
  const moneda = p.moneda as string;
  const pensado = (p.esperado as number | undefined) ?? 0;
  const hogarId = p.hogarId as string | undefined;
  const ingreso = p.tipo === 'INGRESO';
  const tipo = ingreso ? 'INGRESO' : 'GASTO';

  const [movs, setMovs] = useState<MovimientoReporteDTO[] | null>(null);
  const [error, setError] = useState('');

  useTitulo(`${emoji} ${nombre} · ${periodo}`);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const q = hogarId ? `&alcance=hogar&hogarId=${hogarId}` : '&alcance=mios';
      const r = await api.get<ResumenFinancieroDTO>(
        `/usuarios/me/resumen-financiero?desde=${desde}&hasta=${hasta}${q}`,
        token,
      );
      setMovs(r.movimientos.filter((m) => m.tipo === tipo && m.categoriaId === categoriaId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, desde, hasta, hogarId, categoriaId, tipo]);

  useCargaAlEnfocar(cargar);

  if (!movs) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const llevas = movs.reduce((s, m) => s + m.monto, 0);
  const pasado = pensado > 0 && llevas > pensado;
  const hoy = new Date();

  return (
    <Screen onRefresh={cargar}>
      <Datos>
        {pensado > 0 ? <Dato etiqueta="🎯 Pensabas gastar" valor={money(pensado, moneda)} /> : null}
        <Dato
          etiqueta={ingreso ? '📥 Entró' : '🧾 Llevas'}
          valor={pensado > 0 ? `− ${money(llevas, moneda)}` : money(llevas, moneda)}
        />
        {pensado > 0 ? (
          <Dato
            etiqueta={pasado ? '⚠️ Te pasaste' : '✅ Quedan'}
            valor={
              <Text style={{ fontSize: 14, fontWeight: '700', color: pasado ? c.danger : c.ok }}>
                {money(Math.abs(pensado - llevas), moneda)}
              </Text>
            }
          />
        ) : null}
      </Datos>

      <Section
        title={
          ingreso
            ? movs.length === 1 ? '1 ingreso' : `${movs.length} ingresos`
            : movs.length === 1 ? '1 gasto' : `${movs.length} gastos`
        }
      >
        {movs.length === 0 ? (
          <Nota>{ingreso ? 'Todavía no entra nada en esto en este período.' : 'Todavía no gastas nada en esto en este período.'}</Nota>
        ) : (
          <ListCard>
            {movs.map((m) => (
              <TxRow
                key={m.eventoId}
                title={m.glosa || nombre}
                subtitle={`${nombreDia(m.fecha, hoy)}${m.corregido ? ' · cambiado' : ''}`}
                amount={`${ingreso ? '+' : '−'}${money(m.monto, m.moneda)}`}
                positivo={ingreso}
                logo={{ emoji }}
                onPress={() => nav.go('MovimientoDetalle', { eventoId: m.eventoId })}
              />
            ))}
          </ListCard>
        )}
      </Section>
      {categoriaId === null && movs.length > 0 && <Nota>Toca uno para ponerle categoría.</Nota>}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
