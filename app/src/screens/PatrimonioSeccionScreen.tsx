import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ElementoPatrimonialDTO, type SeriePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  Button,
  EmptyState,
  ErrorText,
  etiqueta,
  fechaLegible,
  GroupLabel,
  Hero,
  LinkButton,
  ListCard,
  Nota,
  Panel,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
  type NombreIcono,
} from '../ui';
import { GraficoLinea } from '../ui/charts';

/** Orden de las categorías en "Mi patrimonio" (igual que la composición de Inicio). */
const CATS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'CREDITO', 'DEUDA'] as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function icono(categoria: string): NombreIcono {
  switch (categoria) {
    case 'LIQUIDEZ': return 'wallet-outline';
    case 'RESERVA': return 'shield-checkmark-outline';
    case 'INVERSION': return 'trending-up-outline';
    case 'ACTIVO': return 'home-outline';
    case 'DEUDA': return 'card-outline';
    case 'CREDITO': return 'cash-outline';
    default: return 'ellipse-outline';
  }
}

/**
 * Sin `categoria`: "Mi patrimonio" — todas las cuentas y bienes agrupados por
 * categoría, con la evolución del último año arriba (G32 H-03/H-08). Con
 * `categoria`: solo esa sección. Se llega desde el Hero y la composición de Inicio.
 */
export function PatrimonioSeccionScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const categoria = nav.route.params?.categoria as string | undefined;
  const alcance = (nav.route.params?.alcance as 'mios' | 'hogar' | undefined) ?? 'mios';
  const monedaPrin = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [serie, setSerie] = useState<SeriePatrimonialDTO | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const path =
        alcance === 'hogar'
          ? '/elementos-patrimoniales?alcance=hogar'
          : '/elementos-patrimoniales?propietario=me';
      const els = await api.get<ElementoPatrimonialDTO[]>(path, token);
      setElementos(categoria ? els.filter((e) => e.categoriaFuncional === categoria) : els);
      if (!categoria && alcance === 'mios') {
        const haceUnAnio = new Date(Date.now() - 365 * 86_400_000);
        setSerie(
          await api
            .get<SeriePatrimonialDTO>(`/usuarios/me/serie-patrimonial?desde=${iso(haceUnAnio)}&pasos=12`, token)
            .catch(() => null),
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, categoria, alcance]);

  useCargaAlEnfocar(cargar);

  if (!elementos) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const subtotal = elementos
    .filter((e) => e.moneda === monedaPrin)
    .reduce((s, e) => s + e.valorVigente, 0);
  const otrasMonedas = [...new Set(elementos.filter((e) => e.moneda !== monedaPrin).map((e) => e.moneda))];

  const fila = (el: ElementoPatrimonialDTO) => (
    <TxRow
      key={el.id}
      title={el.nombre}
      subtitle={etiqueta(el.tipo) + (el.estadoOperativo ? ` · ${etiqueta(el.estadoOperativo)}` : '')}
      amount={el.valorOculto ? '—' : money(el.valorVigente, el.moneda)}
      negativo={!el.valorOculto && el.valorVigente < 0}
      logo={{ icon: icono(el.categoriaFuncional) }}
      onPress={() => nav.go('ElementoDetalle', { elementoId: el.id })}
    />
  );

  if (!categoria) {
    const puntos = (serie?.puntos ?? []).map((p) => ({
      etiqueta: fechaLegible(p.fecha),
      valor: p.porMoneda.find((m) => m.moneda === monedaPrin)?.patrimonio ?? 0,
    }));
    return (
      <Screen onRefresh={cargar}>
        <Hero label={alcance === 'hogar' ? 'Patrimonio del hogar' : 'Patrimonio neto'} value={money(subtotal, monedaPrin)} />
        {otrasMonedas.length > 0 && <Nota>También hay elementos en {otrasMonedas.join(', ')}.</Nota>}

        {puntos.length >= 2 && (
          <Section title="Último año">
            <Panel>
              <GraficoLinea puntos={puntos} formatoValor={(n) => money(n, monedaPrin)} />
            </Panel>
          </Section>
        )}
        {alcance === 'mios' && (
          <LinkButton
            title="Consultar otra fecha o período ›"
            onPress={() => nav.go('EvolucionPatrimonio')}
          />
        )}

        {elementos.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            titulo="Aún no tienes cuentas ni bienes"
            descripcion={alcance === 'mios' ? 'Agrega tu primera cuenta, inversión o deuda.' : undefined}
            accion={alcance === 'mios' ? 'Agregar cuenta o bien' : undefined}
            onAccion={alcance === 'mios' ? () => nav.go('AgregarElemento') : undefined}
          />
        ) : (
          CATS.map((cat) => {
            const delCat = elementos.filter((e) => e.categoriaFuncional === cat);
            if (delCat.length === 0) return null;
            const sub = delCat
              .filter((e) => e.moneda === monedaPrin)
              .reduce((s, e) => s + e.valorVigente, 0);
            return (
              <View key={cat} style={{ gap: 8 }}>
                <GroupLabel right={<Text style={{ color: c.muted, fontWeight: '600' }}>{money(sub, monedaPrin)}</Text>}>
                  {etiqueta(cat)}
                </GroupLabel>
                <ListCard>{delCat.map(fila)}</ListCard>
              </View>
            );
          })
        )}

        {alcance === 'mios' && elementos.length > 0 && (
          <Button title="Agregar cuenta o bien" variant="secondary" onPress={() => nav.go('AgregarElemento')} />
        )}

        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  // §G28 — en DEUDA/CREDITO separamos las financieras de los encargos/custodia.
  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';
  const custodia = esDeudaOCredito
    ? elementos.filter((e) => e.naturaleza === 'CUSTODIA_INFORMAL')
    : [];
  const financieras = esDeudaOCredito
    ? elementos.filter((e) => e.naturaleza !== 'CUSTODIA_INFORMAL')
    : elementos;

  return (
    <Screen onRefresh={cargar}>
      <Hero label={etiqueta(categoria)} value={money(subtotal, monedaPrin)} />
      {otrasMonedas.length > 0 && <Nota>También hay elementos en {otrasMonedas.join(', ')}.</Nota>}

      {elementos.length === 0 ? (
        <EmptyState
          icon={icono(categoria)}
          titulo={`Sin elementos en “${etiqueta(categoria)}”`}
          descripcion={alcance === 'mios' ? 'Agrega uno para verlo acá.' : undefined}
          accion={alcance === 'mios' ? 'Agregar cuenta o bien' : undefined}
          onAccion={alcance === 'mios' ? () => nav.go('AgregarElemento') : undefined}
        />
      ) : custodia.length > 0 ? (
        <>
          {financieras.length > 0 && (
            <>
              <GroupLabel>Financieras</GroupLabel>
              <ListCard>{financieras.map(fila)}</ListCard>
            </>
          )}
          <GroupLabel>Encargos y custodia</GroupLabel>
          <ListCard>{custodia.map(fila)}</ListCard>
        </>
      ) : (
        <ListCard>{financieras.map(fila)}</ListCard>
      )}

      {alcance === 'mios' && elementos.length > 0 && (
        <Button title="Agregar cuenta o bien" variant="secondary" onPress={() => nav.go('AgregarElemento')} />
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
