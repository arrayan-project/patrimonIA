import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
  type ObjetivoFinancieroDTO,
  type ReservaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  ErrorText,
  etiqueta,
  Field,
  Hero,
  LinkButton,
  ListCard,
  Nota,
  ProgressBar,
  Screen,
  Section,
  Segmented,
  SelectRow,
  TxRow,
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
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
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
      const asgs = await api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token);
      setAsignaciones(asgs);
      if (o.puedoModificar) {
        const els = await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
          .catch(() => []);
        setCuentas(els.filter((e) => e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO'));
        const rs = await Promise.all(
          asgs.map((a) => api.get<ReservaDTO[]>(`/asignaciones/${a.id}/reservas`, token).catch(() => [])),
        );
        setReservas(rs.flat());
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

  if (!obj) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // HZ-13: las cuentas propias donde la meta tiene plata; si es una sola, el
  // gasto llega con ella elegida.
  const cuentasConPlata = [
    ...new Set(
      reservas
        .filter((r) => r.estado === 'ACTIVA' && cuentas.some((c) => c.id === r.elementoOrigenId))
        .map((r) => r.elementoOrigenId),
    ),
  ];
  return (
    <Screen onRefresh={cargar}>
      <Hero
        label={obj.nombre}
        value={money(obj.progreso, obj.moneda)}
        substats={[
          { label: 'de', value: money(obj.montoObjetivo, obj.moneda) },
          { label: 'Avance', value: `${obj.progresoPorcentaje}%` },
        ]}
      >
        <ProgressBar pct={obj.progresoPorcentaje} />
      </Hero>
      <Nota>
        {etiqueta(obj.estado)}
        {obj.hogarId ? ' · meta del hogar' : ''}
      </Nota>
      {obj.hogarId && !obj.puedoModificar && (
        <Ayuda>Meta del hogar. Puedes verla pero no modificarla (no eres designado).</Ayuda>
      )}
      {/* D-1: ahorrar es una pantalla propia (varias cuentas, la cuenta de la meta). */}
      {obj.puedoModificar && obj.estado === 'EN_PROGRESO' && (
        <Button title="Ahorrar" onPress={() => nav.go('Ahorrar', { objetivoId })} />
      )}
      {obj.puedoModificar && cuentasConPlata.length > 0 && (
        <Button
          title="Usar esta plata"
          variant="secondary"
          onPress={() =>
            nav.go('RegistrarMovimiento', {
              tipo: 'GASTO',
              objetivoId,
              ...(cuentasConPlata.length === 1 ? { origenId: cuentasConPlata[0] } : {}),
            })
          }
        />
      )}

      {(asignaciones.length > 0 || obj.puedoModificar) && (
        <Section title="En la meta">
          {asignaciones.length === 0 ? (
            <Text style={styles.muted}>Aún no ahorras para esta meta.</Text>
          ) : (
            <ListCard>
              {asignaciones.map((a) => (
                <TxRow
                  key={a.id}
                  title={a.nombre}
                  amount={money(a.totalReservado, a.moneda)}
                  logo={{ icon: 'flag-outline' }}
                  onPress={() => nav.go('AsignacionDetalle', { asignacionId: a.id, contexto: obj.nombre })}
                />
              ))}
            </ListCard>
          )}
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
        </Section>
      )}

      {obj.esMio && hogarId && (
        <Section title="Compartir con el hogar">
          <Panel>
            <Segmented
              label="¿La compartes con el hogar?"
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
        </Section>
      )}

      {obj.puedoModificar && (
      <Section title="Estado">
        <Panel>
          <Segmented label="¿En qué estado está?" options={ESTADOS} value={nuevoEstado} onChange={setNuevoEstado} />
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
      </Section>
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
  muted: tipoDe(c).nota,
});
