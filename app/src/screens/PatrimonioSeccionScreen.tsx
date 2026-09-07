import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import {
  Button,
  EmptyState,
  ErrorText,
  etiqueta,
  GroupLabel,
  Hero,
  Nota,
  Panel,
  Screen,
  Skeleton,
  TxRow,
  type NombreIcono,
} from '../ui';

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
const COLOR: Record<string, string> = {
  LIQUIDEZ: '#3b82f6', RESERVA: '#0d9488', INVERSION: '#16a34a',
  ACTIVO: '#ca8a04', DEUDA: '#dc2626', CREDITO: '#9333ea',
};

/** Lista de elementos de una categoría funcional. Se llega desde la composición de Inicio. */
export function PatrimonioSeccionScreen() {
  const { token } = useSession();
  const nav = useNav();
  const categoria = nav.route.params?.categoria as string;
  const alcance = (nav.route.params?.alcance as 'mios' | 'hogar' | undefined) ?? 'mios';
  const monedaPrin = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const path =
        alcance === 'hogar'
          ? '/elementos-patrimoniales?alcance=hogar'
          : '/elementos-patrimoniales?propietario=me';
      const els = await api.get<ElementoPatrimonialDTO[]>(path, token);
      setElementos(els.filter((e) => e.categoriaFuncional === categoria));
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
      logo={{ icon: icono(categoria), color: COLOR[categoria] }}
      onPress={() => nav.go('ElementoDetalle', { elementoId: el.id })}
    />
  );

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
              <Panel gap={0}>{financieras.map(fila)}</Panel>
            </>
          )}
          <GroupLabel>Encargos y custodia</GroupLabel>
          <Panel gap={0}>{custodia.map(fila)}</Panel>
        </>
      ) : (
        <Panel gap={0}>{financieras.map(fila)}</Panel>
      )}

      {alcance === 'mios' && elementos.length > 0 && (
        <Button title="Agregar cuenta o bien" variant="secondary" onPress={() => nav.go('AgregarElemento')} />
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
