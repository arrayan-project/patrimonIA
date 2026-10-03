import { useMemo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
  type ObjetivoFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { GLOSARIO } from '../labels';
import { useToast } from '../ui/Toast';
import { opcionesDeElementos } from '../opciones';
import {
  Elegir,
  contadorPasos,
  Ayuda,
  Button,
  ErrorText,
  etiqueta,
  Field,
  LinkButton,
  MoneyField,
  ProgressBar,
  Row,
  Screen,
  Segmented,
  SelectRow,
  Title,
  Skeleton,
  Panel,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

const ESTADOS = ['EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const;

export function ObjetivoDetalleScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const objetivoId = nav.route.params?.objetivoId as string;

  const [obj, setObj] = useState<ObjetivoFinancieroDTO | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [designados, setDesignados] = useState<string[]>([]);
  const [nombreAsg, setNombreAsg] = useState('');
  const [verPartes, setVerPartes] = useState(false);
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[]>([]);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [parteId, setParteId] = useState<string | null>(null);
  const [montoApartar, setMontoApartar] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<(typeof ESTADOS)[number]>('EN_PROGRESO');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const o = await api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${objetivoId}`, token);
      setObj(o);
      setNuevoEstado(o.estado as (typeof ESTADOS)[number]);
      setDesignados(o.designados);
      setAsignaciones(await api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token));
      if (o.puedoModificar) {
        const els = await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
          .catch(() => []);
        setCuentas(els.filter((e) => e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO'));
      }
      const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []);
      setHogarId(hs[0]?.id ?? null);
      if (o.esMio && hs[0]) {
        const h = await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token).catch(() => null);
        setMiembros(h?.miembros ?? []);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [objetivoId, token]);

  useCargaAlEnfocar(cargar);

  const run = async (fn: () => Promise<unknown>, salir = false) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (salir) nav.back();
      else await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  /**
   * G32 H-02 — "apartar para esta meta" en un paso: la asignación es un detalle
   * del modelo. Si el objetivo no tiene una, se crea con su nombre; si tiene
   * una sola, se reutiliza; si tiene varias, el usuario elige la parte.
   */
  const apartar = async () => {
    if (!obj || !origenId) return;
    setBusy(true);
    setError('');
    try {
      let asignacionId = parteId ?? asignaciones[0]?.id;
      if (!asignacionId) {
        const nueva = await api.post<AsignacionDTO>(
          '/comandos/CrearAsignacion',
          { nombre: obj.nombre, objetivoId },
          token,
        );
        // Si la reserva falla, el reintento reutiliza esta asignación.
        setAsignaciones([nueva]);
        asignacionId = nueva.id;
      }
      await api.post(
        '/comandos/CrearReserva',
        { asignacionId, elementoOrigenId: origenId, monto: Number(montoApartar) },
        token,
      );
      toast.mostrar('Ahorro registrado');
      setMontoApartar('');
      setOrigenId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!obj) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  return (
    <Screen onRefresh={cargar}>
      <Title>{obj.nombre}</Title>
      <ProgressBar pct={obj.progresoPorcentaje} />
      <Text style={styles.muted}>
        {money(obj.progreso, obj.moneda)} de {money(obj.montoObjetivo, obj.moneda)} · {obj.progresoPorcentaje}% ·{' '}
        {etiqueta(obj.estado)}
        {obj.hogarId ? ' · del hogar' : ''}
      </Text>
      {obj.hogarId && !obj.puedoModificar && (
        <Ayuda>Meta del hogar. Puedes verla pero no modificarla (no eres designado).</Ayuda>
      )}

      {obj.puedoModificar && (
        <Panel>
          <Text style={styles.sectionTitle}>Ahorrar</Text>
          <Ayuda>{GLOSARIO.apartado}</Ayuda>
          {cuentas.length === 0 ? (
            <Text style={styles.muted}>Primero agrega una cuenta desde donde ahorrar.</Text>
          ) : (
            <>
              <Elegir
                label="Desde qué cuenta"
                paso={paso({ hecho: !!origenId })}
                placeholder="Elegir cuenta"
                value={origenId}
                options={opcionesDeElementos(cuentas)}
                onChange={setOrigenId}
              />
              {asignaciones.length > 1 && (
                <Elegir
                  label="¿Para qué parte de la meta?"
                  paso={paso({ hecho: true })}
                  value={parteId ?? asignaciones[0].id}
                  options={asignaciones.map((a) => ({ value: a.id, label: a.nombre }))}
                  onChange={(v) => v && setParteId(v)}
                />
              )}
              <MoneyField label="¿Cuánto?" paso={paso({ hecho: Number(montoApartar) > 0 })} value={montoApartar} onChange={setMontoApartar} moneda={obj.moneda} />
              <Button
                title="Ahorrar"
                loading={busy}
                disabled={!origenId || !(Number(montoApartar) > 0)}
                onPress={apartar}
              />
            </>
          )}
        </Panel>
      )}

      {(asignaciones.length > 0 || obj.puedoModificar) && (
        <Panel>
          <Text style={styles.sectionTitle}>En la meta</Text>
          {asignaciones.length === 0 && <Text style={styles.muted}>Aún no ahorras para esta meta.</Text>}
          {asignaciones.map((a) => (
            <Pressable
              key={a.id}
              style={styles.asg}
              accessibilityRole="button"
              accessibilityLabel={`${a.nombre}, ${money(a.totalReservado, a.moneda)}`}
              onPress={() =>
                nav.go('AsignacionDetalle', { asignacionId: a.id, contexto: obj.nombre })
              }
            >
              <Row left={`${a.nombre} ›`} right={money(a.totalReservado, a.moneda)} />
            </Pressable>
          ))}
          {obj.puedoModificar &&
            (verPartes ? (
              <>
                <Ayuda>
                  Opcional: divide la meta en partes (p. ej. "Pie" y "Gastos notariales") para
                  seguir cada una por separado.
                </Ayuda>
                <Field label="Nombre de la parte" value={nombreAsg} onChangeText={setNombreAsg} autoCapitalize="sentences" />
                <Button
                  title="Agregar parte"
                  variant="secondary"
                  loading={busy}
                  disabled={!nombreAsg.trim()}
                  onPress={() =>
                    run(async () => {
                      await api.post(
                        '/comandos/CrearAsignacion',
                        { nombre: nombreAsg.trim(), objetivoId },
                        token,
                      );
                      setNombreAsg('');
                      setVerPartes(false);
                    })
                  }
                />
              </>
            ) : (
              <LinkButton title="Dividir la meta en partes (opcional)" onPress={() => setVerPartes(true)} />
            ))}
        </Panel>
      )}

      {obj.esMio && hogarId && (
        <Panel>
          <Text style={styles.sectionTitle}>Compartir con el hogar</Text>
          <Segmented
            label="¿Compartido?"
            options={['No', 'Sí'] as const}
            value={obj.hogarId ? 'Sí' : 'No'}
            formatearOpcion={(v) => v}
            onChange={(v) =>
              run(() =>
                api.post(
                  '/comandos/CompartirObjetivoConHogar',
                  { objetivoId, hogarId: v === 'Sí' ? hogarId : null },
                  token,
                ),
              )
            }
          />
          {obj.hogarId && (
            <>
              <Ayuda>Elige quién más puede modificar esta meta (ahorrar, editar).</Ayuda>
              {miembros
                .filter((m) => m.usuarioId !== usuario.id)
                .map((m) => (
                  <SelectRow
                    key={m.usuarioId}
                    label={m.nombre}
                    selected={designados.includes(m.usuarioId)}
                    onPress={() =>
                      setDesignados((d) =>
                        d.includes(m.usuarioId)
                          ? d.filter((x) => x !== m.usuarioId)
                          : [...d, m.usuarioId],
                      )
                    }
                  />
                ))}
              <Button
                title="Guardar designados"
                variant="secondary"
                loading={busy}
                disabled={
                  [...designados].sort().join() === [...obj.designados].sort().join()
                }
                onPress={() =>
                  run(() =>
                    api.post(
                      '/comandos/DefinirDesignadosObjetivo',
                      { objetivoId, usuarioIds: designados },
                      token,
                    ),
                  )
                }
              />
            </>
          )}
        </Panel>
      )}

      {obj.puedoModificar && (
      <Panel>
        <Segmented label="Estado" options={ESTADOS} value={nuevoEstado} onChange={setNuevoEstado} />
        <Button
          title="Cambiar estado"
          variant="secondary"
          loading={busy}
          disabled={nuevoEstado === obj.estado}
          onPress={() =>
            run(() =>
              api.post(
                '/comandos/CambiarEstadoObjetivoFinanciero',
                { objetivoId, estado: nuevoEstado },
                token,
              ),
            )
          }
        />
        {obj.esMio && (
          <>
            <Field label="Motivo (para eliminar)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
            <Button
              title="Eliminar meta"
              variant="secondary"
              loading={busy}
              disabled={motivo.trim().length < 3}
              onPress={() =>
                run(
                  () =>
                    api.post(
                      '/comandos/EliminarObjetivoFinanciero',
                      { objetivoId, motivo: motivo.trim() },
                      token,
                    ),
                  true,
                )
              }
            />
          </>
        )}
      </Panel>
      )}

      <Button
        title="Historial de cambios"
        variant="secondary"
        onPress={() =>
          nav.go('Historial', {
            entidadTipo: 'OBJETIVO_FINANCIERO',
            entidadId: objetivoId,
            contexto: obj.nombre,
          })
        }
      />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
  asg: { borderTopWidth: 1, borderTopColor: c.faint, paddingTop: 4 },
  muted: tipoDe(c).nota,
});
