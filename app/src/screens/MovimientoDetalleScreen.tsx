import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type EventoFinancieroDTO,
  type HogarDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  Button,
  colors,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Row,
  Screen,
  Title,
} from '../ui';

export function MovimientoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const eventoId = nav.route.params?.eventoId as string;
  const elementoId = nav.route.params?.elementoId as string | undefined;

  const [evento, setEvento] = useState<EventoFinancieroDTO | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [tieneCorreccion, setTieneCorreccion] = useState(false);
  const [error, setError] = useState('');

  const [modo, setModo] = useState<null | 'corregir' | 'anular'>(null);
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const ev = await api.get<EventoFinancieroDTO>(`/eventos-financieros/${eventoId}`, token);
      setEvento(ev);
      setNuevoMonto(String(ev.monto));
      if (ev.categoriaId && categorias.length === 0) {
        const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        if (hs[0]) {
          setCategorias(
            await api.get<CategoriaMovimientoDTO[]>(
              `/hogares/${hs[0].id}/categorias-movimiento?incluirArchivadas=true`,
              token,
            ),
          );
        }
      }
      if (elementoId) {
        const lista = await api.get<EventoFinancieroDTO[]>(
          `/eventos-financieros?elemento=${elementoId}`,
          token,
        );
        setTieneCorreccion(lista.some((e) => e.correccionDeId === eventoId && !e.anulado));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [eventoId, elementoId, token]);

  useCargaAlEnfocar(cargar);

  const ejecutar = async () => {
    setEnviando(true);
    setError('');
    try {
      if (modo === 'corregir') {
        await api.post(
          '/comandos/CorregirEventoFinanciero',
          { eventoId, nuevoMonto: Number(nuevoMonto), motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Movimiento corregido');
      } else {
        if (!(await confirmar('Anular movimiento', 'Se revierte su efecto sobre el saldo. Queda en el historial marcado como anulado.', 'Anular'))) {
          setEnviando(false);
          return;
        }
        await api.post(
          '/comandos/AnularEventoFinanciero',
          { eventoId, motivo: motivo.trim() },
          token,
        );
        toast.mostrar('Movimiento anulado');
      }
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  };

  if (!evento) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  const impacto = evento.impactos.find((i) => i.elementoId === elementoId);
  const esCorreccion = evento.correccionDeId !== null;
  const accionable = !evento.anulado && !esCorreccion && !tieneCorreccion;

  return (
    <Screen onRefresh={cargar}>
      <Title>{evento.glosa || etiqueta(evento.tipo)}</Title>
      <Text style={styles.monto}>{money(evento.monto, evento.moneda)}</Text>

      <View style={styles.card}>
        <Row left="Fecha" right={fechaLegible(evento.fecha)} />
        {evento.glosa ? <Row left="Detalle" right={evento.glosa} /> : null}
        {evento.categoriaId ? (
          <Row
            left="Categoría"
            right={categorias.find((c) => c.id === evento.categoriaId)?.nombre ?? '—'}
          />
        ) : null}
        {impacto && (
          <Row left="Efecto en esta cuenta" right={money(impacto.monto, evento.moneda)} />
        )}
        <Row left="Estado" right={evento.anulado ? 'Anulado' : 'Vigente'} />
        {esCorreccion && <Text style={styles.nota}>Es la corrección de un movimiento anterior.</Text>}
        {tieneCorreccion && (
          <Text style={styles.nota}>Este movimiento ya fue corregido — corrige o anula esa corrección.</Text>
        )}
      </View>

      {accionable && modo === null && (
        <View style={{ gap: 8 }}>
          <Button title="Corregir monto" onPress={() => setModo('corregir')} />
          <Button title="Anular movimiento" variant="danger" onPress={() => setModo('anular')} />
        </View>
      )}

      {modo === 'corregir' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Corregir monto</Text>
          <MoneyField label="Monto correcto" value={nuevoMonto} onChange={setNuevoMonto} moneda={evento.moneda} />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se corrige" autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar corrección" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </View>
      )}

      {modo === 'anular' && (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Anular movimiento</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se anula" autoCapitalize="sentences" />
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
  monto: { fontSize: 28, fontWeight: '800', color: colors.text },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 8 },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  nota: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
