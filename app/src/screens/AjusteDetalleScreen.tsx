import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Button, colors, ErrorText, Field, fechaLegible, LinkButton, MoneyField, Row, Screen, Title } from '../ui';

export function AjusteDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const ajusteId = nav.route.params?.ajusteId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';

  const [ajuste, setAjuste] = useState<AjustePatrimonialDTO | null>(null);
  const [tieneCorreccion, setTieneCorreccion] = useState(false);
  const [error, setError] = useState('');

  const [modo, setModo] = useState<null | 'corregir' | 'anular'>(null);
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<AjustePatrimonialDTO[]>(
        `/ajustes-patrimoniales?elemento=${elementoId}`,
        token,
      );
      const a = lista.find((x) => x.id === ajusteId) ?? null;
      setAjuste(a);
      if (a) setNuevoMonto(String(a.monto));
      setTieneCorreccion(lista.some((x) => x.correccionDeId === ajusteId && !x.anulado));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, ajusteId, token]);

  useCargaAlEnfocar(cargar);

  const ejecutar = async () => {
    setEnviando(true);
    setError('');
    try {
      if (modo === 'corregir') {
        await api.post(
          '/comandos/CorregirAjustePatrimonial',
          { ajusteId, nuevoMonto: Number(nuevoMonto), motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Ajuste corregido');
      } else {
        if (!(await confirmar('Anular ajuste', 'Se revierte el efecto del ajuste sobre el saldo.', 'Anular'))) {
          setEnviando(false);
          return;
        }
        await api.post(
          '/comandos/AnularAjustePatrimonial',
          { ajusteId, motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Ajuste anulado');
      }
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  };

  if (!ajuste) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  const accionable = !ajuste.anulado && ajuste.correccionDeId === null && !tieneCorreccion;

  return (
    <Screen onRefresh={cargar}>
      <Title>Ajuste patrimonial</Title>
      <Text style={styles.monto}>{money(ajuste.monto, moneda)}</Text>
      <View style={styles.card}>
        <Row left="Fecha" right={fechaLegible(ajuste.fecha)} />
        <Row left="Motivo" right={ajuste.motivo} />
        <Row left="Estado" right={ajuste.anulado ? 'Anulado' : 'Vigente'} />
        {ajuste.correccionDeId && <Text style={styles.nota}>Es la corrección de un ajuste anterior.</Text>}
      </View>

      {accionable && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Corregir monto" onPress={() => setModo('corregir')} />
          <Button title="Anular ajuste" variant="danger" onPress={() => setModo('anular')} />
        </View>
      )}

      {modo === 'corregir' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Corregir monto</Text>
          <MoneyField label="Monto correcto" value={nuevoMonto} onChange={setNuevoMonto} moneda={moneda} />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar corrección" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </View>
      )}

      {modo === 'anular' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Anular ajuste</Text>
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
  monto: { fontSize: 24, fontWeight: '800', color: colors.text },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  nota: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
