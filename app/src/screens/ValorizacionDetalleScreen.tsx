import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Button, colors, ErrorText, Field, fechaLegible, LinkButton, MoneyField, Row, Screen, Title } from '../ui';

export function ValorizacionDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const valorizacionId = nav.route.params?.valorizacionId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [val, setVal] = useState<ValorizacionDTO | null>(null);
  const [esUltimaVigente, setEsUltimaVigente] = useState(false);
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
        if (!(await confirmar('Anular valorización', 'El valor del elemento vuelve al anterior a esta valorización.', 'Anular'))) {
          setEnviando(false);
          return;
        }
        await api.post(
          '/comandos/AnularValorizacion',
          { valorizacionId, motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Valorización anulada');
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
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  const accionable = !val.anulada && val.correccionDeId === null && esUltimaVigente;

  return (
    <Screen onRefresh={cargar}>
      <Title>Valorización</Title>
      <Text style={styles.valor}>
        {money(val.valorAnterior, moneda)} → {money(val.valorNuevo, moneda)}
      </Text>

      <View style={styles.card}>
        <Row left="Fecha" right={fechaLegible(val.fecha)} />
        <Row left="Estado" right={val.anulada ? 'Anulada' : 'Vigente'} />
        {val.correccionDeId && (
          <Text style={styles.nota}>Es la corrección de una valorización anterior.</Text>
        )}
        {!accionable && !val.anulada && !val.correccionDeId && (
          <Text style={styles.nota}>
            Solo se puede corregir o anular la última valorización vigente.
          </Text>
        )}
      </View>

      {accionable && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Corregir valor" onPress={() => setModo('corregir')} />
          <Button title="Anular valorización" variant="danger" onPress={() => setModo('anular')} />
        </View>
      )}

      {modo === 'corregir' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Corregir valor</Text>
          <MoneyField label="Valor correcto" value={valorCorrecto} onChange={setValorCorrecto} moneda={moneda} />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar corrección" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </View>
      )}

      {modo === 'anular' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Anular valorización</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Anular" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </View>
      )}

      {modo === null && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  valor: { fontSize: 20, fontWeight: '800', color: colors.text },
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 8 },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  nota: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
