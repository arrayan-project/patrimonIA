import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Migaja, Skeleton, Button, ErrorText, Field, fechaLegible, LinkButton, MoneyField, Row, Screen, Title, Panel, useC, type Paleta } from '../ui';

export function AjusteDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const ajusteId = nav.route.params?.ajusteId as string;
  const elementoId = nav.route.params?.elementoId as string;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;

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
        if (!(await confirmar('Eliminar ajuste', 'Se revierte el efecto del ajuste sobre el saldo.', 'Eliminar'))) {
          setEnviando(false);
          return;
        }
        await api.post(
          '/comandos/AnularAjustePatrimonial',
          { ajusteId, motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Ajuste eliminado');
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
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const accionable = !ajuste.anulado && ajuste.correccionDeId === null && !tieneCorreccion;

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Title>Ajuste patrimonial</Title>
      <Text style={styles.monto}>{money(ajuste.monto, moneda)}</Text>
      <Panel>
        <Row left="Fecha" right={fechaLegible(ajuste.fecha)} />
        <Row left="Motivo" right={ajuste.motivo} />
        <Row left="Estado" right={ajuste.anulado ? 'Eliminado' : 'Vigente'} />
        {ajuste.correccionDeId && <Text style={styles.nota}>Es la corrección de un ajuste anterior.</Text>}
      </Panel>

      {accionable && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Corregir monto" onPress={() => setModo('corregir')} />
          <Button title="Eliminar ajuste" variant="danger" onPress={() => setModo('anular')} />
        </View>
      )}

      {modo === 'corregir' && (
        <Panel>
          <Text style={styles.formTitle}>Corregir monto</Text>
          <MoneyField label="Monto correcto" value={nuevoMonto} onChange={setNuevoMonto} moneda={moneda} />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar corrección" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === 'anular' && (
        <Panel>
          <Text style={styles.formTitle}>Eliminar ajuste</Text>
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
  monto: { fontSize: 24, fontWeight: '800', color: c.text },
  formTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  nota: { fontSize: 13, color: c.muted, fontStyle: 'italic' },
});
