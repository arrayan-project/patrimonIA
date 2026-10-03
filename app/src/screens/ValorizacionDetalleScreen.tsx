import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Migaja, Skeleton, Button, ErrorText, Field, fechaLegible, LinkButton, MoneyField, Row, Screen, Title, Panel, useC, type Paleta } from '../ui';

export function ValorizacionDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const valorizacionId = nav.route.params?.valorizacionId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;

  const [val, setVal] = useState<ValorizacionDTO | null>(null);
  const [esUltimaVigente, setEsUltimaVigente] = useState(false);
  const [corregida, setCorregida] = useState(false);
  const [error, setError] = useState('');

  const [modo, setModo] = useState<null | 'corregir' | 'anular'>(null);
  const [valorCorrecto, setValorCorrecto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<ValorizacionDTO[]>(
        `/elementos-patrimoniales/${elementoId}/valorizaciones`,
        token,
      );
      const v = lista.find((x) => x.id === valorizacionId) ?? null;
      setVal(v);
      if (v) setValorCorrecto(String(v.valorNuevo));
      setEsUltimaVigente(lista.filter((x) => !x.anulada)[0]?.id === valorizacionId);
      setCorregida(lista.some((x) => !x.anulada && x.correccionDeId === valorizacionId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, valorizacionId, token]);

  useCargaAlEnfocar(cargar);

  const ejecutar = async () => {
    setEnviando(true);
    setError('');
    try {
      if (modo === 'corregir') {
        await api.post(
          '/comandos/CorregirValorizacion',
          { valorizacionId, valorCorrecto: Number(valorCorrecto), motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Valorización corregida');
      } else {
        const efecto = esUltimaVigente
          ? 'El valor del elemento se descuenta en lo que subió o bajó con esta valorización.'
          : 'El valor actual no cambia (lo fija una valorización posterior); se recalcula el historial entre ambas.';
        if (!(await confirmar('Eliminar valorización', efecto, 'Eliminar'))) {
          setEnviando(false);
          return;
        }
        await api.post(
          '/comandos/AnularValorizacion',
          { valorizacionId, motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Valorización eliminada');
      }
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  };

  if (!val) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // G11: cualquier valorización vigente, no solo la última; si ya tiene una
  // corrección vigente, se actúa sobre la corrección.
  const accionable = !val.anulada && val.correccionDeId === null && !corregida;

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Title>Valorización</Title>
      <Text style={styles.valor}>
        {money(val.valorAnterior, moneda)} → {money(val.valorNuevo, moneda)}
      </Text>

      <Panel>
        <Row left="Fecha" right={fechaLegible(val.fecha)} />
        <Row left="Estado" right={val.anulada ? 'Eliminada' : 'Vigente'} />
        {val.correccionDeId && (
          <Text style={styles.nota}>Es la corrección de una valorización anterior.</Text>
        )}
        {corregida && !val.anulada && (
          <Text style={styles.nota}>Esta valorización ya fue corregida.</Text>
        )}
      </Panel>

      {accionable && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Corregir valor" onPress={() => setModo('corregir')} />
          <Button title="Eliminar valorización" variant="danger" onPress={() => setModo('anular')} />
        </View>
      )}

      {modo === 'corregir' && (
        <Panel>
          <Text style={styles.formTitle}>Corregir valor</Text>
          <MoneyField label="Valor correcto" value={valorCorrecto} onChange={setValorCorrecto} moneda={moneda} />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar corrección" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === 'anular' && (
        <Panel>
          <Text style={styles.formTitle}>Eliminar valorización</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Eliminar" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === null && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  valor: { fontSize: 20, fontWeight: '800', color: c.text },
  formTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  nota: { fontSize: 13, color: c.muted, fontStyle: 'italic' },
});
