import { useMemo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  ErrorText,
  Field,
  Paragraph,
  Screen,
  Segmented,
  Select,
  Title,
  Skeleton,
  Panel,
  useC,
  tipoDe,
  type Paleta,
} from '../ui';
import { etiqueta, TIPOS_ELEMENTO_SUGERIDOS } from '../labels';

const OPC_TIPO = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({ value: t, label: etiqueta(t) }));

const VIS = ['PRIVADA', 'COMPARTIDA', 'FAMILIAR'] as const;

/** Solo dígitos, máx 2 decimales, en [0, 100]. */
function limpiarPct(t: string): string {
  let s = t.replace(',', '.').replace(/[^\d.]/g, '');
  const i = s.indexOf('.');
  if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2);
  if (Number(s) > 100) s = '100';
  return s;
}

export function EditarElementoScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;

  const [el, setEl] = useState<ElementoPatrimonialDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [visibilidad, setVisibilidad] = useState<(typeof VIS)[number]>('PRIVADA');
  const [enConsolidacion, setEnConsolidacion] = useState<'No' | 'Sí'>('No');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Propietarios (A3 — CambiarPropiedadElementoPatrimonial) ────────────────
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [pcts, setPcts] = useState<Record<string, string>>({});

  const propsEditados = Object.entries(pcts)
    .map(([usuarioId, v]) => ({ usuarioId, porcentaje: Number(v || 0) }))
    .filter((p) => p.porcentaje > 0);
  const firmaReparto = (arr: { usuarioId: string; porcentaje: number }[]) =>
    arr
      .map((p) => `${p.usuarioId}:${p.porcentaje}`)
      .sort()
      .join('|');
  const repartoCambiado =
    !!el &&
    firmaReparto(propsEditados) !==
      firmaReparto(el.propietarios.map((p) => ({ usuarioId: p.usuarioId, porcentaje: p.porcentaje })));

  const sucio =
    !!el &&
    (nombre.trim() !== el.nombre ||
      tipo.trim() !== el.tipo ||
      visibilidad !== el.visibilidad ||
      (enConsolidacion === 'Sí') !== el.participaConsolidacion ||
      repartoCambiado ||
      motivo.trim().length > 0);
  const permitirSalida = useConfirmarDescarte(sucio && !busy);

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token)
      .then((e) => {
        setEl(e);
        setNombre(e.nombre);
        setTipo(e.tipo);
        setVisibilidad(e.visibilidad as (typeof VIS)[number]);
        setEnConsolidacion(e.participaConsolidacion ? 'Sí' : 'No');
        setPcts(
          Object.fromEntries(
            e.propietarios.map((p) => [p.usuarioId, String(p.porcentaje)]),
          ),
        );
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [elementoId, token]);

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then((hs) => (hs[0] ? api.get<HogarDTO>(`/hogares/${hs[0].id}`, token) : null))
      .then((h) => setMiembros(h?.miembros ?? []))
      .catch(() => setMiembros([]));
  }, [token]);

  const run = async (fn: () => Promise<unknown>, aviso?: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (aviso) toast.mostrar(aviso);
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!el) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const activo = el.estado === 'ACTIVO';

  const personas = (() => {
    const map = new Map<string, string>();
    for (const p of el.propietarios) map.set(p.usuarioId, p.nombre ?? 'Propietario');
    for (const m of miembros) {
      map.set(m.usuarioId, m.usuarioId === usuario.id ? `${m.nombre} (tú)` : m.nombre);
    }
    return [...map.entries()].map(([usuarioId, nombre]) => ({ usuarioId, nombre }));
  })();
  const puedeEditarPropietarios = personas.length > 1;
  const totalPct = propsEditados.reduce((s, p) => s + p.porcentaje, 0);
  const errReparto =
    Math.abs(totalPct - 100) > 0.001
      ? `Los porcentajes tienen que sumar 100% (van ${Math.round(totalPct * 100) / 100}%).`
      : propsEditados.length === 0
        ? 'Asigna al menos un propietario.'
        : '';

  return (
    <Screen>
      <Title>Editar {el.nombre}</Title>

      {activo && (
        <Panel>
          <Field label="Nombre" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" />
          <Select label="Tipo" value={tipo} options={OPC_TIPO} onChange={setTipo} permiteOtro />
          <Button
            title="Guardar datos"
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/ActualizarDatosElementoPatrimonial',
                  { elementoId, nombre: nombre.trim(), tipo: tipo.trim() },
                  token,
                ),
              )
            }
            loading={busy}
          />
        </Panel>
      )}

      {activo && (
        <Panel>
          <Segmented label="Visibilidad" options={VIS} value={visibilidad} onChange={setVisibilidad} />
          <Ayuda>
            Privada: solo tú la ves. Compartida / Familiar: los miembros de tu
            hogar ven este elemento en las vistas del hogar.
          </Ayuda>
          <Button
            title="Cambiar visibilidad"
            variant="secondary"
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/CambiarVisibilidadElementoPatrimonial',
                  { elementoId, visibilidad },
                  token,
                ),
              )
            }
            loading={busy}
          />
        </Panel>
      )}

      {activo && (
        <Panel>
          <Segmented
            label="¿Cuenta en el patrimonio del hogar?"
            options={['No', 'Sí'] as const}
            value={enConsolidacion}
            onChange={setEnConsolidacion}
          />
          <Ayuda>
            Si está en "Sí", esto suma en "Patrimonio del hogar" (la vista
            consolidada de todos los miembros).
          </Ayuda>
          <Button
            title="Guardar"
            variant="secondary"
            loading={busy}
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/CambiarParticipacionEnConsolidacion',
                  { elementoId, participa: enConsolidacion === 'Sí' },
                  token,
                ),
              )
            }
          />
        </Panel>
      )}

      {activo && puedeEditarPropietarios && (
        <Panel>
          <Text style={styles.sectionTitle}>Propietarios</Text>
          <Ayuda>
            Reparte el 100% entre los propietarios. Quien quede en 0% deja de ser
            propietario. Cada uno ve su parte en su patrimonio.
          </Ayuda>
          {personas.map((p) => (
            <View key={p.usuarioId} style={styles.filaPct}>
              <Text style={styles.filaNombre} numberOfLines={1}>
                {p.nombre}
              </Text>
              <View style={styles.pctInput}>
                <Field
                  label=""
                  value={pcts[p.usuarioId] ?? ''}
                  onChangeText={(t) => setPcts((x) => ({ ...x, [p.usuarioId]: limpiarPct(t) }))}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              <Text style={styles.pctSigno}>%</Text>
            </View>
          ))}
          <Text style={[styles.total, Math.abs(totalPct - 100) < 0.001 && styles.totalOk]}>
            Total: {Math.round(totalPct * 100) / 100}%
          </Text>
          {repartoCambiado && errReparto ? <ErrorText>{errReparto}</ErrorText> : null}
          <Button
            title="Cambiar propietarios"
            variant="secondary"
            loading={busy}
            disabled={!repartoCambiado || !!errReparto}
            onPress={() =>
              run(
                () =>
                  api.post(
                    '/comandos/CambiarPropiedadElementoPatrimonial',
                    { elementoId, propietarios: propsEditados },
                    token,
                  ),
                'Propietarios actualizados',
              )
            }
          />
        </Panel>
      )}

      <Panel>
        <Text style={styles.sectionTitle}>Estado</Text>
        <Field label="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" placeholder="Requerido para reactivar/eliminar" />
        {activo ? (
          <>
            <Button
              title="Desactivar"
              variant="danger"
              loading={busy}
              onPress={async () => {
                if (!(await confirmar('Desactivar', 'Deja de contar en tu patrimonio. Se puede reactivar después.', 'Desactivar')))
                  return;
                await run(
                  () =>
                    api.post(
                      '/comandos/DesactivarElementoPatrimonial',
                      { elementoId, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) },
                      token,
                    ),
                  'Desactivado',
                );
              }}
            />
            <Paragraph>
              Eliminar solo si nunca tuvo movimientos ni valorizaciones.
            </Paragraph>
            <Button
              title="Eliminar"
              variant="danger"
              loading={busy}
              disabled={motivo.trim().length < 3}
              onPress={async () => {
                if (!(await confirmar('Eliminar', 'Borrado definitivo. Solo si nunca tuvo movimientos ni valorizaciones.', 'Eliminar')))
                  return;
                await run(
                  () =>
                    api.post(
                      '/comandos/EliminarElementoPatrimonial',
                      { elementoId, justificacion: motivo.trim() },
                      token,
                    ),
                  'Eliminado',
                );
              }}
            />
          </>
        ) : (
          <Button
            title="Reactivar"
            loading={busy}
            disabled={motivo.trim().length < 3}
            onPress={() =>
              run(() =>
                api.post(
                  '/comandos/ReactivarElementoPatrimonial',
                  { elementoId, motivo: motivo.trim() },
                  token,
                ),
              )
            }
          />
        )}
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
  filaPct: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNombre: { flex: 1, fontSize: 14, color: c.text },
  pctInput: { width: 76 },
  pctSigno: { fontSize: 15, color: c.muted, fontWeight: '600' },
  total: { fontSize: 13, fontWeight: '700', color: c.muted, textAlign: 'right' },
  totalOk: { color: c.primary },
});
