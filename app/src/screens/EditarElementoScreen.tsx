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
  DateField,
  Elegir,
  ErrorText,
  Field,
  LinkButton,
  MoneyField,
  Nota,
  Paragraph,
  Screen,
  Segmented,
  SectionTitle,
  Select,
  SelectRow,
  Title,
  Skeleton,
  Panel,
  useC,
  tipoDe,
  type Paleta,
} from '../ui';
import { etiqueta, TIPOS_ELEMENTO_SUGERIDOS } from '../labels';
import { aplicarNivel, nivelDe, opcionesNivel, type NivelHogar } from '../compartirHogar';

const OPC_TIPO_FALLBACK = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({
  value: etiqueta(t),
  label: etiqueta(t),
}));

const VIS = ['PRIVADA', 'COMPARTIDA', 'FAMILIAR'] as const;
type Nivel = (typeof VIS)[number];
const TIPOS_INFO = [
  ['EXISTENCIA', 'Que existe'],
  ['VALOR', 'El monto'],
  ['MOVIMIENTOS', 'Los movimientos'],
] as const;

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
  const [modoDato, setModoDato] = useState<'Actualización' | 'Corrección'>('Actualización');
  const [motivoDato, setMotivoDato] = useState('');
  const [niveles, setNiveles] = useState<Record<string, Nivel>>({
    EXISTENCIA: 'PRIVADA',
    VALOR: 'PRIVADA',
    MOVIMIENTOS: 'PRIVADA',
  });
  const [compartidoCon, setCompartidoCon] = useState<string[]>([]);
  const [enConsolidacion, setEnConsolidacion] = useState<'No' | 'Sí'>('No');
  // D-2: una pregunta con 4 niveles; el detalle por tipo queda en "Avanzado".
  const [nivelHogar, setNivelHogar] = useState<NivelHogar | 'personalizado'>('personalizado');
  const [avanzado, setAvanzado] = useState(false);
  const [valoriza, setValoriza] = useState<'No' | 'Sí'>('No');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Propietarios (A3 — CambiarPropiedadElementoPatrimonial) ────────────────
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [tiposCat, setTiposCat] = useState<string[]>([]);
  const [pcts, setPcts] = useState<Record<string, string>>({});

  // ── Detalle de deuda/crédito (§B3) ────────────────────────────────────────
  const [contraparte, setContraparte] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaTermino, setFechaTermino] = useState('');
  const [fechaBaja, setFechaBaja] = useState('');
  const [cuota, setCuota] = useState('');
  const [tasa, setTasa] = useState('');
  const [observaciones, setObservaciones] = useState('');

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

  const esDeudaOCredito =
    !!el && (el.categoriaFuncional === 'DEUDA' || el.categoriaFuncional === 'CREDITO');
  const detalleDto: Record<string, string | number> = {};
  if (el) {
    if (contraparte.trim() !== (el.contraparte ?? '')) detalleDto.contraparte = contraparte.trim();
    if (fechaInicio !== (el.fechaInicio ?? '')) detalleDto.fechaInicio = fechaInicio;
    if (fechaTermino !== (el.fechaTermino ?? '')) detalleDto.fechaTermino = fechaTermino;
    const cuotaOrig = el.cuotaMonto != null ? String(el.cuotaMonto) : '';
    if (cuota.trim() !== cuotaOrig && Number(cuota) > 0) detalleDto.cuotaMonto = Number(cuota);
    const tasaOrig = el.tasaInteres != null ? String(el.tasaInteres) : '';
    if (tasa.trim() !== tasaOrig && Number(tasa) >= 0 && tasa.trim() !== '')
      detalleDto.tasaInteres = Number(tasa);
    if (observaciones.trim() !== (el.observaciones ?? ''))
      detalleDto.observaciones = observaciones.trim();
  }
  const detalleCambiado = Object.keys(detalleDto).length > 0;

  const vptOrig = el
    ? (el.visibilidadPorTipo ?? {
        EXISTENCIA: el.visibilidad,
        VALOR: el.visibilidad,
        MOVIMIENTOS: el.visibilidad,
      })
    : null;
  const visibilidadCambiada =
    !!vptOrig &&
    (TIPOS_INFO.some(([k]) => niveles[k] !== vptOrig[k]) ||
      [...compartidoCon].sort().join() !== [...(el?.compartidoCon ?? [])].sort().join());

  const sucio =
    !!el &&
    (nombre.trim() !== el.nombre ||
      tipo.trim() !== el.tipo ||
      nivelHogar !== nivelDe(el) ||
      visibilidadCambiada ||
      (enConsolidacion === 'Sí') !== el.participaConsolidacion ||
      (valoriza === 'Sí') !== el.admiteValorizacion ||
      repartoCambiado ||
      detalleCambiado ||
      motivoDato.trim().length > 0 ||
      motivo.trim().length > 0);
  const permitirSalida = useConfirmarDescarte(sucio && !busy);

  useEffect(() => {
    api
      .get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token)
      .then((e) => {
        setEl(e);
        setNombre(e.nombre);
        setTipo(e.tipo);
        const vpt =
          e.visibilidadPorTipo ??
          { EXISTENCIA: e.visibilidad, VALOR: e.visibilidad, MOVIMIENTOS: e.visibilidad };
        setNiveles({
          EXISTENCIA: vpt.EXISTENCIA as Nivel,
          VALOR: vpt.VALOR as Nivel,
          MOVIMIENTOS: vpt.MOVIMIENTOS as Nivel,
        });
        setCompartidoCon(e.compartidoCon ?? []);
        setEnConsolidacion(e.participaConsolidacion ? 'Sí' : 'No');
        setNivelHogar(nivelDe(e));
        setValoriza(e.admiteValorizacion ? 'Sí' : 'No');
        setPcts(
          Object.fromEntries(
            e.propietarios.map((p) => [p.usuarioId, String(p.porcentaje)]),
          ),
        );
        setContraparte(e.contraparte ?? '');
        setFechaInicio(e.fechaInicio ?? '');
        setFechaTermino(e.fechaTermino ?? '');
        setCuota(e.cuotaMonto != null ? String(e.cuotaMonto) : '');
        setTasa(e.tasaInteres != null ? String(e.tasaInteres) : '');
        setObservaciones(e.observaciones ?? '');
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [elementoId, token]);

  useEffect(() => {
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then(async (hs) => {
        const h0 = hs[0]?.id;
        if (!h0) return;
        const [h, tipos] = await Promise.all([
          api.get<HogarDTO>(`/hogares/${h0}`, token),
          api
            .get<{ nombre: string }[]>(`/hogares/${h0}/tipos-elemento`, token)
            .catch(() => [] as { nombre: string }[]),
        ]);
        setMiembros(h?.miembros ?? []);
        setTiposCat(tipos.map((t) => t.nombre));
      })
      .catch(() => setMiembros([]));
  }, [token]);

  const opcTipo = useMemo(() => {
    const base =
      tiposCat.length > 0 ? tiposCat.map((n) => ({ value: n, label: n })) : OPC_TIPO_FALLBACK;
    // asegura que el tipo actual del elemento aparezca aunque no esté en el catálogo
    return tipo && !base.some((o) => o.value === tipo)
      ? [{ value: tipo, label: tipo }, ...base]
      : base;
  }, [tiposCat, tipo]);

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
  const coMiembros = miembros.filter((m) => m.usuarioId !== usuario.id);
  const pareja = coMiembros.length === 1 ? coMiembros[0].nombre : undefined;
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
          <Select label="Tipo" value={tipo} options={opcTipo} onChange={setTipo} permiteOtro />
          <Segmented
            label="¿Por qué cambias esto?"
            options={['Actualización', 'Corrección'] as const}
            value={modoDato}
            onChange={setModoDato}
            formatearOpcion={(v) => v}
          />
          <Ayuda>
            {modoDato === 'Actualización'
              ? 'Actualización: el dato cambió en la realidad (le pusiste otro nombre, cambió de tipo).'
              : 'Corrección: el dato estaba mal registrado desde el principio. Queda constancia en el historial de que fue una corrección y por qué.'}
          </Ayuda>
          {modoDato === 'Corrección' && (
            <Field
              label="Motivo de la corrección"
              value={motivoDato}
              onChangeText={setMotivoDato}
              autoCapitalize="sentences"
              placeholder="Estaba mal escrito el nombre del banco"
            />
          )}
          <Button
            title={modoDato === 'Corrección' ? 'Guardar corrección' : 'Guardar datos'}
            loading={busy}
            disabled={modoDato === 'Corrección' && motivoDato.trim().length < 3}
            onPress={() =>
              run(
                () =>
                  modoDato === 'Corrección'
                    ? api.post(
                        '/comandos/CorregirDatosElementoPatrimonial',
                        {
                          elementoId,
                          nombre: nombre.trim(),
                          tipo: tipo.trim(),
                          motivo: motivoDato.trim(),
                        },
                        token,
                      )
                    : api.post(
                        '/comandos/ActualizarDatosElementoPatrimonial',
                        { elementoId, nombre: nombre.trim(), tipo: tipo.trim() },
                        token,
                      ),
                modoDato === 'Corrección' ? 'Corrección guardada' : undefined,
              )
            }
          />
        </Panel>
      )}

      {activo && (
        <Panel>
          <SectionTitle>Compartir con el hogar</SectionTitle>
          <Elegir
            label={`¿Qué compartes de ${el.nombre} con ${pareja ?? 'el hogar'}?`}
            value={nivelHogar}
            options={[
              ...opcionesNivel(pareja),
              ...(nivelDe(el) === 'personalizado'
                ? [
                    {
                      value: 'personalizado',
                      label: 'Personalizado',
                      sub: 'Una combinación hecha en Avanzado.',
                      deshabilitada: true,
                    },
                  ]
                : []),
            ]}
            onChange={(v) => v && setNivelHogar(v as NivelHogar)}
          />
          <Button
            title="Guardar"
            variant="secondary"
            loading={busy}
            disabled={nivelHogar === 'personalizado' || nivelHogar === nivelDe(el)}
            onPress={() =>
              nivelHogar !== 'personalizado' &&
              run(() => aplicarNivel(token, elementoId, nivelHogar, el.participaConsolidacion), 'Guardado')
            }
          />
          <LinkButton
            title={avanzado ? 'Ocultar avanzado' : 'Avanzado (cada dato por separado)'}
            onPress={() => setAvanzado((x) => !x)}
          />
        </Panel>
      )}

      {activo && avanzado && (
        <Panel>
          <SectionTitle>Visibilidad</SectionTitle>
          <Ayuda>
            Elige, para cada dato, quién puede verlo. Privada: solo tú. Familiar:
            todos los miembros del hogar. Compartida: solo las personas que elijas.
          </Ayuda>
          {TIPOS_INFO.map(([k, etiq]) => (
            <Segmented
              key={k}
              label={etiq}
              options={VIS}
              value={niveles[k]}
              onChange={(v) => setNiveles((n) => ({ ...n, [k]: v }))}
            />
          ))}
          {coMiembros.length > 0 && Object.values(niveles).includes('COMPARTIDA') && (
            <>
              <Text style={styles.sectionTitle}>Compartir con</Text>
              {coMiembros.map((m) => (
                <SelectRow
                  key={m.usuarioId}
                  label={m.nombre}
                  selected={compartidoCon.includes(m.usuarioId)}
                  onPress={() =>
                    setCompartidoCon((xs) =>
                      xs.includes(m.usuarioId)
                        ? xs.filter((x) => x !== m.usuarioId)
                        : [...xs, m.usuarioId],
                    )
                  }
                />
              ))}
            </>
          )}
          <Button
            title="Guardar visibilidad"
            variant="secondary"
            loading={busy}
            disabled={!visibilidadCambiada}
            onPress={() =>
              run(
                () =>
                  api.post(
                    '/comandos/DefinirVisibilidadElementoPatrimonial',
                    { elementoId, niveles, compartidoCon },
                    token,
                  ),
                'Visibilidad actualizada',
              )
            }
          />
        </Panel>
      )}

      {activo && avanzado && (
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

      {activo && !esDeudaOCredito && (
        <Panel>
          <Segmented
            label="¿Se valoriza en el tiempo?"
            options={['No', 'Sí'] as const}
            value={valoriza}
            onChange={setValoriza}
          />
          <Ayuda>
            Actívalo para bienes o inversiones cuyo valor de mercado cambia
            (inmuebles, fondos). Habilita "Registrar valorización" en el detalle.
          </Ayuda>
          <Button
            title="Guardar"
            variant="secondary"
            loading={busy}
            disabled={(valoriza === 'Sí') === el.admiteValorizacion}
            onPress={() =>
              run(
                () =>
                  api.post(
                    '/comandos/CambiarAdmiteValorizacion',
                    { elementoId, admite: valoriza === 'Sí' },
                    token,
                  ),
                'Guardado',
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

      {activo && esDeudaOCredito && (
        <Panel>
          <SectionTitle>
            Detalle {el.categoriaFuncional === 'DEUDA' ? 'de la deuda' : 'del crédito'}
          </SectionTitle>
          <Nota>Todo opcional. Sirve para seguir un crédito real (hipotecario, préstamo).</Nota>
          <Field
            label={el.categoriaFuncional === 'DEUDA' ? 'Acreedor (a quién le debes)' : 'Deudor (quién te debe)'}
            value={contraparte}
            onChangeText={setContraparte}
            autoCapitalize="sentences"
          />
          <DateField label="Fecha de inicio" value={fechaInicio} onChange={setFechaInicio} optional />
          <DateField label="Fecha de término" value={fechaTermino} onChange={setFechaTermino} optional />
          <MoneyField label="Cuota" value={cuota} onChange={setCuota} moneda={el.moneda} />
          <Field label="Tasa de interés anual (%)" value={tasa} onChangeText={setTasa} keyboardType="numeric" />
          <Field
            label="Observaciones"
            value={observaciones}
            onChangeText={setObservaciones}
            autoCapitalize="sentences"
          />
          <Button
            title="Guardar detalle"
            variant="secondary"
            loading={busy}
            disabled={!detalleCambiado}
            onPress={() =>
              run(
                () =>
                  api.post(
                    '/comandos/ActualizarDatosElementoPatrimonial',
                    { elementoId, ...detalleDto },
                    token,
                  ),
                'Detalle guardado',
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
            <DateField
              label="Fecha de salida (opcional)"
              value={fechaBaja}
              onChange={setFechaBaja}
              optional
            />
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
                      {
                        elementoId,
                        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
                        ...(fechaBaja.trim() ? { fechaBaja: fechaBaja.trim() } : {}),
                      },
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
