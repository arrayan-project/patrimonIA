import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type ElementoPatrimonialDTO,
  type EtiquetaDTO,
  type EventoFinancieroDTO,
  type HogarDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import {
  aISO,
  Ayuda,
  Button,
  Chip,
  DateField,
  ErrorText,
  etiqueta,
  Field,
  fechaLegible,
  LinkButton,
  MoneyField,
  Migaja,
  Panel,
  Row,
  Screen,
  Stat,
  Title,
  Skeleton,
  useC,
  type Paleta,
} from '../ui';

export function MovimientoDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const eventoId = nav.route.params?.eventoId as string;
  const elementoId = nav.route.params?.elementoId as string | undefined;
  const contexto = nav.route.params?.contexto as string | undefined;

  const [evento, setEvento] = useState<EventoFinancieroDTO | null>(null);
  const [nombresImpacto, setNombresImpacto] = useState<Record<string, string>>({});
  const [categorias, setCategorias] = useState<CategoriaMovimientoDTO[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaDTO[]>([]);
  const [tieneCorreccion, setTieneCorreccion] = useState(false);
  const [error, setError] = useState('');

  const [modo, setModo] = useState<null | 'corregir' | 'anular' | 'plantilla' | 'etiquetas'>(null);
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState(aISO(new Date()));
  const [nuevaGlosa, setNuevaGlosa] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const ev = await api.get<EventoFinancieroDTO>(`/eventos-financieros/${eventoId}`, token);
      setEvento(ev);
      if (ev.tipo === 'TRANSFERENCIA' || ev.tipo === 'CONVERSION') {
        const pares = await Promise.all(
          ev.impactos.map(async (im) => {
            try {
              const el = await api.get<ElementoPatrimonialDTO>(
                `/elementos-patrimoniales/${im.elementoId}`,
                token,
              );
              return [im.elementoId, el.nombre] as const;
            } catch {
              return [im.elementoId, 'otra cuenta'] as const;
            }
          }),
        );
        setNombresImpacto(Object.fromEntries(pares));
      }
      setNuevoMonto(String(ev.monto));
      setNuevaFecha(ev.fecha);
      setNuevaGlosa(ev.glosa ?? '');
      setEtiquetaIds(ev.etiquetaIds);
      if (etiquetas.length === 0) {
        setEtiquetas(await api.get<EtiquetaDTO[]>('/usuarios/me/etiquetas', token).catch(() => []));
      }
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
    if (!evento) return;
    setEnviando(true);
    setError('');
    try {
      if (modo === 'corregir') {
        const body: Record<string, unknown> = { eventoId, motivo: motivo.trim() };
        if (Number(nuevoMonto) !== evento.monto) body.nuevoMonto = Number(nuevoMonto);
        if (nuevaFecha !== evento.fecha) body.nuevaFecha = nuevaFecha;
        if (nuevaGlosa.trim() !== (evento.glosa ?? '')) body.nuevaGlosa = nuevaGlosa.trim();
        await api.post('/comandos/CorregirEventoFinanciero', body, token);
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
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const impacto = evento.impactos.find((i) => i.elementoId === elementoId);
  const esInterno = evento.tipo === 'TRANSFERENCIA' || evento.tipo === 'CONVERSION';
  const origen = esInterno ? evento.impactos.find((i) => i.monto < 0) : undefined;
  const destino = esInterno ? evento.impactos.find((i) => i.monto > 0) : undefined;
  const esCorreccion = evento.correccionDeId !== null;
  const accionable = !evento.anulado && !esCorreccion && !tieneCorreccion;
  const puedePlantilla = !evento.anulado && evento.tipo !== 'CONVERSION';

  const guardarEtiquetas = async () => {
    setEnviando(true);
    setError('');
    try {
      await api.post('/comandos/EtiquetarEvento', { eventoId, etiquetaIds }, token);
      toast.mostrar('Etiquetas actualizadas');
      setModo(null);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  };

  const guardarPlantilla = async () => {
    setEnviando(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearPlantillaMovimiento',
        {
          nombre: nombrePlantilla.trim(),
          tipo: evento.tipo,
          monto: evento.monto,
          moneda: evento.moneda,
          elementoOrigenId: evento.impactos.find((i) => Number(i.monto) < 0)?.elementoId,
          elementoDestinoId: evento.impactos.find((i) => Number(i.monto) > 0)?.elementoId,
          ...(evento.categoriaId ? { categoriaId: evento.categoriaId } : {}),
          ...(evento.glosa ? { glosa: evento.glosa } : {}),
        },
        token,
      );
      toast.mostrar('Plantilla creada');
      setModo(null);
      setNombrePlantilla('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Title>{evento.glosa || etiqueta(evento.tipo)}</Title>
      <Stat label={etiqueta(evento.tipo)} value={money(evento.monto, evento.moneda)} />


      <Panel>
        <Row left="Fecha" right={fechaLegible(evento.fecha)} />
        {esInterno && (
          <>
            <Row
              left="Desde"
              right={origen ? (nombresImpacto[origen.elementoId] ?? '…') : '—'}
            />
            <Row
              left="Hacia"
              right={destino ? (nombresImpacto[destino.elementoId] ?? '…') : '—'}
            />
          </>
        )}
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
        {evento.etiquetaIds.length > 0 && (
          <View style={styles.chips}>
            {evento.etiquetaIds.map((id) => {
              const e = etiquetas.find((x) => x.id === id);
              return <Chip key={id} label={e?.nombre ?? '—'} color={e?.color} activo />;
            })}
          </View>
        )}
        {esCorreccion && <Text style={styles.nota}>Es la corrección de un movimiento anterior.</Text>}
        {tieneCorreccion && (
          <Text style={styles.nota}>Este movimiento ya fue corregido — corrige o anula esa corrección.</Text>
        )}
      </Panel>

      {modo === null && accionable && (
        <Ayuda>
          Corregir: el movimiento ocurrió pero con otro monto, fecha o detalle. Se
          registra la diferencia y el original queda enlazado a su corrección. Anular:
          el movimiento no ocurrió — se revierte su efecto por completo.
        </Ayuda>
      )}

      {modo === null && (
        <View style={{ gap: 8 }}>
          {accionable && <Button title="Corregir" onPress={() => setModo('corregir')} />}
          {puedePlantilla && (
            <Button
              title="Guardar como plantilla"
              variant="secondary"
              onPress={() => {
                setNombrePlantilla(evento.glosa ?? '');
                setModo('plantilla');
              }}
            />
          )}
          {!evento.anulado && etiquetas.length > 0 && (
            <Button
              title="Editar etiquetas"
              variant="secondary"
              onPress={() => {
                setEtiquetaIds(evento.etiquetaIds);
                setModo('etiquetas');
              }}
            />
          )}
          {accionable && (
            <Button title="Anular movimiento" variant="danger" onPress={() => setModo('anular')} />
          )}
        </View>
      )}

      {modo === 'etiquetas' && (
        <Panel>
          <Text style={styles.formTitle}>Etiquetas</Text>
          <View style={styles.chips}>
            {etiquetas.map((e) => (
              <Chip
                key={e.id}
                label={e.nombre}
                color={e.color}
                activo={etiquetaIds.includes(e.id)}
                onPress={() =>
                  setEtiquetaIds((xs) =>
                    xs.includes(e.id) ? xs.filter((x) => x !== e.id) : [...xs, e.id],
                  )
                }
              />
            ))}
          </View>
          <ErrorText>{error}</ErrorText>
          <Button title="Guardar" onPress={guardarEtiquetas} loading={enviando} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === 'plantilla' && (
        <Panel>
          <Text style={styles.formTitle}>Guardar como plantilla</Text>
          <Text style={styles.nota}>
            Se guarda el tipo, el monto, las cuentas, la categoría y el detalle para
            reutilizarlos.
          </Text>
          <Field
            label="Nombre de la plantilla"
            value={nombrePlantilla}
            onChangeText={setNombrePlantilla}
            autoCapitalize="sentences"
            placeholder="p. ej. Arriendo"
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title="Guardar plantilla"
            onPress={guardarPlantilla}
            loading={enviando}
            disabled={!nombrePlantilla.trim()}
          />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === 'corregir' && (
        <Panel>
          <Text style={styles.formTitle}>Corregir movimiento</Text>
          <Ayuda>
            El movimiento ocurrió, pero con otro monto, fecha o detalle. Se registra una
            corrección enlazada; el original queda intacto. Para cambiar el tipo o los
            elementos, anula y regístralo de nuevo.
          </Ayuda>
          <MoneyField label="Monto correcto" value={nuevoMonto} onChange={setNuevoMonto} moneda={evento.moneda} />
          <DateField label="Fecha correcta" value={nuevaFecha} onChange={setNuevaFecha} />
          <Field label="Detalle" value={nuevaGlosa} onChangeText={setNuevaGlosa} placeholder="Glosa del movimiento" autoCapitalize="sentences" />
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se corrige" autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button
            title="Guardar corrección"
            onPress={ejecutar}
            loading={enviando}
            disabled={
              motivo.trim().length < 3 ||
              (Number(nuevoMonto) === evento.monto &&
                nuevaFecha === evento.fecha &&
                nuevaGlosa.trim() === (evento.glosa ?? ''))
            }
          />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === 'anular' && (
        <Panel>
          <Text style={styles.formTitle}>Anular movimiento</Text>
          <Field label="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Por qué se anula" autoCapitalize="sentences" />
          <ErrorText>{error}</ErrorText>
          <Button title="Anular" onPress={ejecutar} loading={enviando} disabled={motivo.trim().length < 3} />
          <LinkButton title="Cancelar" onPress={() => setModo(null)} />
        </Panel>
      )}

      {modo === null && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  formTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  nota: { fontSize: 13, color: c.muted, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
