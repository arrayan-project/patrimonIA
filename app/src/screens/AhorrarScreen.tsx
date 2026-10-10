import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type ObjetivoFinancieroDTO,
  type PatrimonioIndividualDTO,
  type ReservaDTO,
  type ResumenFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { DIAS_RECIENTES, ultimaCuenta, type MovimientoReciente } from '../recientes';
import { money, porcentaje } from '../format';
import { emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { useToast } from '../ui/Toast';
import {
  AmountInput,
  aISO,
  BandaDetalle,
  Button,
  Chip,
  Dato,
  Datos,
  Elegir,
  ErrorText,
  Nota,
  Panel,
  Pastilla,
  Question,
  Screen,
  Skeleton,
  useC,
  type Paleta,
} from '../ui';

type Origen = { cuentaId: string | null; monto: string };
/** G39 (F-15): cuántas metas van como botones. */
const METAS_A_LA_VISTA = 4;

interface ResultadoAhorro {
  progreso: number;
}

/**
 * G33 D-1 — Ahorrar para una meta (A1, A2, A6), como en el prototipo: se elige
 * la meta y de qué cuenta(s) sale la plata; cada una muestra lo libre para
 * ahorrar. La cuenta de la meta se pregunta solo la primera vez (después se
 * deriva de dónde ya está su plata). Un solo comando: AhorrarParaObjetivo.
 */
export function AhorrarScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const { preferencias } = usePreferencias();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const [metas, setMetas] = useState<ObjetivoFinancieroDTO[] | null>(null);
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[]>([]);
  const [libre, setLibre] = useState<Record<string, number>>({});
  // HZ-18: plata de otras personas en tus cuentas, por moneda.
  const [ajena, setAjena] = useState<Record<string, number>>({});
  const [objetivoId, setObjetivoId] = useState<string | null>(
    (nav.route.params?.objetivoId as string | undefined) ?? null,
  );
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  // Desde el Detalle de una parte, llega ya elegida.
  const [parteId, setParteId] = useState<string | null>(
    (nav.route.params?.asignacionId as string | undefined) ?? null,
  );
  // La cuenta de la meta derivada de sus reservas (null = aún no tiene).
  const [cuentaMeta, setCuentaMeta] = useState<string | null>(null);
  const [destinoElegido, setDestinoElegido] = useState<string | null>(null);
  const [origenes, setOrigenes] = useState<Origen[]>([{ cuentaId: null, monto: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // G39 (F-16): los movimientos recientes dicen de qué cuenta ahorraste la última vez.
  const [recientes, setRecientes] = useState<MovimientoReciente[] | null>(null);
  const [recordada, setRecordada] = useState<string | null>(null);
  // G39 (F-15): las metas que había antes de ir a "Nueva meta", para elegir la nueva al volver.
  const idsAntes = useRef<Set<string> | null>(null);

  const sucio = origenes.some((o) => o.cuentaId || o.monto);
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  // Se recarga al volver (p. ej. de "Nueva meta"): la meta nueva queda elegida.
  const cargar = useCallback(() => {
    Promise.all([
      api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
      api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      api.get<{ elementoId: string; disponible: number }[]>('/usuarios/me/disponibilidad', token),
    ])
      .then(([objs, els, disp]) => {
        const enCamino = objs.filter((o) => o.estado === 'EN_PROGRESO' && o.puedoModificar);
        setMetas(enCamino);
        const antes = idsAntes.current;
        const nueva = antes ? enCamino.find((o) => !antes.has(o.id)) : undefined;
        idsAntes.current = null;
        if (nueva) setObjetivoId(nueva.id);
        else if (enCamino.length === 1) setObjetivoId((actual) => actual ?? enCamino[0].id);
        setCuentas(
          els.filter(
            // Solo cuentas: no deudas, créditos ni bienes.
            (e) => e.estado === 'ACTIVO' && !['DEUDA', 'CREDITO', 'ACTIVO'].includes(e.categoriaFuncional),
          ),
        );
        setLibre(Object.fromEntries(disp.map((d) => [d.elementoId, d.disponible])));
      })
      .catch((e: unknown) => {
        setMetas([]);
        setError(e instanceof ApiError ? e.message : 'Error inesperado');
      });
    api
      .get<PatrimonioIndividualDTO>('/usuarios/me/patrimonio-individual', token)
      .then((p) => setAjena(Object.fromEntries(p.porMoneda.map((m) => [m.moneda, m.plataAjena]))))
      .catch(() => setAjena({}));
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - DIAS_RECIENTES * 24 * 60 * 60 * 1000);
    api
      .get<ResumenFinancieroDTO>(`/usuarios/me/resumen-financiero?desde=${aISO(desde)}&hasta=${aISO(hoy)}&alcance=mios`, token)
      .then((r) => setRecientes(r.movimientos))
      .catch(() => setRecientes([]));
  }, [token]);
  useCargaAlEnfocar(cargar);
  const nuevaMeta = () => {
    idsAntes.current = new Set((metas ?? []).map((m) => m.id));
    nav.go('MetaForm');
  };

  // G39 (F-16): con la cuenta de la meta conocida, la de tu último ahorro hacia ella
  // viene elegida como "¿De dónde sale la plata?" (solo si aún no eligió).
  useEffect(() => {
    if (!cuentaMeta || !recientes) return;
    const r = ultimaCuenta(recientes, 'TRANSFERENCIA', (id, lado) =>
      lado === 'destino' ? id === cuentaMeta : id !== cuentaMeta && cuentas.some((x) => x.id === id),
    );
    if (!r?.origenId) return;
    setOrigenes((xs) => (xs.length === 1 && !xs[0].cuentaId ? [{ ...xs[0], cuentaId: r.origenId }] : xs));
    setRecordada(r.origenId);
  }, [cuentaMeta, recientes, cuentas]);

  // Al elegir la meta: sus partes y la cuenta donde ya está su plata.
  useEffect(() => {
    setAsignaciones([]);
    setParteId(null);
    setCuentaMeta(null);
    setDestinoElegido(null);
    if (!objetivoId) return;
    let vigente = true;
    (async () => {
      const asgs = await api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token).catch(() => []);
      const rs = await Promise.all(
        asgs.map((a) => api.get<ReservaDTO[]>(`/asignaciones/${a.id}/reservas`, token).catch(() => [])),
      );
      if (!vigente) return;
      setAsignaciones(asgs);
      const propias = new Set(cuentas.map((x) => x.id));
      const porCuenta = new Map<string, number>();
      for (const r of rs.flat()) {
        if (r.estado !== 'ACTIVA' || !propias.has(r.elementoOrigenId)) continue;
        porCuenta.set(r.elementoOrigenId, (porCuenta.get(r.elementoOrigenId) ?? 0) + r.monto);
      }
      let mejor: string | null = null;
      for (const [id, m] of porCuenta) if (mejor === null || m > (porCuenta.get(mejor) ?? 0)) mejor = id;
      setCuentaMeta(mejor);
    })();
    return () => {
      vigente = false;
    };
  }, [objetivoId, token, cuentas]);

  if (!metas) {
    return (
      <Screen>
        <Skeleton filas={3} />
      </Screen>
    );
  }

  const meta = metas.find((m) => m.id === objetivoId);
  const enMoneda = cuentas.filter((x) => !meta || x.moneda === meta.moneda);
  const nombre = (id: string | null) => cuentas.find((x) => x.id === id)?.nombre ?? '';
  const libreDe = (id: string | null) => (id ? Math.max(0, libre[id] ?? 0) : 0);
  // Sin cuenta de la meta y un solo origen, la plata se queda en ese origen (A6).
  const destino = cuentaMeta ?? destinoElegido ?? (origenes.length === 1 ? origenes[0].cuentaId : null);

  const validos = origenes.filter((o) => o.cuentaId && Number(o.monto) > 0);
  const total = validos.reduce((s, o) => s + Number(o.monto), 0);
  const excede = origenes.find((o) => o.cuentaId && Number(o.monto) > libreDe(o.cuentaId) + 1e-9);

  const setOrigen = (i: number, cambio: Partial<Origen>) =>
    setOrigenes((xs) => xs.map((o, j) => (j === i ? { ...o, ...cambio } : o)));

  // G35: lo que sube la meta se ve en la banda; aquí solo si la plata cambia de cuenta.
  const resumen = (() => {
    if (!meta || validos.length === 0 || !destino) return '';
    const movidos = validos.filter((o) => o.cuentaId !== destino);
    // G39 (F-17): si la plata queda en la misma cuenta, se dice que no se mueve.
    if (!movidos.length) return `🐷 La plata se queda en ${nombre(destino)}, separada para ${meta.nombre}: no se mueve.`;
    return `🔁 Se mueven ${movidos.map((o) => `${money(Number(o.monto), meta.moneda)} de ${nombre(o.cuentaId)}`).join(' y ')} a ${nombre(destino)}. Hazlo también en tu banco; acá queda anotado.`;
  })();

  const puedeEnviar = !!meta && validos.length === origenes.length && !!destino && !excede;

  const onSubmit = async () => {
    if (!meta || !puedeEnviar) return;
    setError('');
    setLoading(true);
    try {
      const r = await api.comando<ResultadoAhorro>(
        '/comandos/AhorrarParaObjetivo',
        {
          objetivoId: meta.id,
          ...(parteId ? { asignacionId: parteId } : {}),
          destinoId: destino,
          origenes: validos.map((o) => ({ elementoId: o.cuentaId, monto: Number(o.monto) })),
        },
        token,
        key,
      );
      toast.mostrar(`Tu meta ${meta.nombre} sube a ${money(r.progreso, meta.moneda)}`);
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (metas.length === 0) {
    return (
      <Screen>
        <Nota>No tienes metas en progreso donde ahorrar. Crea una meta primero.</Nota>
        <Button title="🎯 Crear una meta" onPress={nuevaMeta} />
      </Screen>
    );
  }

  const metasALaVista = metas.slice(0, METAS_A_LA_VISTA);
  // G35: sin numerar.
  const verParte = asignaciones.length > 1;
  const verCuentaMeta = !!meta && !cuentaMeta && origenes.length > 1;

  return (
    <Screen
      pie={
        <>
          {resumen ? <Nota>{resumen}</Nota> : !puedeEnviar ? <Nota>Elige la meta, de dónde sale la plata y cuánto.</Nota> : null}
          <Button
            title={total > 0 && meta ? `🐷 Ahorrar ${money(total, meta.moneda)}` : '🐷 Ahorrar'}
            onPress={onSubmit}
            loading={loading}
            disabled={!puedeEnviar}
          />
        </>
      }
    >
      {/* G39 (F-15): las metas en camino a un toque, con su emoji. */}
      <View style={styles.grupo}>
        <Question>¿Para qué meta?</Question>
        <View style={styles.chips}>
          {metasALaVista.map((m) => (
            <Pastilla
              key={m.id}
              label={`${emojiMeta(m.id, preferencias.emojis.metas)} ${m.nombre}`}
              activo={objetivoId === m.id}
              onPress={() => setObjetivoId(m.id)}
            />
          ))}
          {meta && !metasALaVista.some((m) => m.id === meta.id) ? (
            <Pastilla label={`${emojiMeta(meta.id, preferencias.emojis.metas)} ${meta.nombre}`} activo onPress={() => undefined} />
          ) : null}
          {metas.length > METAS_A_LA_VISTA && (
            <Elegir
              label="¿Para qué meta?"
              value={objetivoId}
              options={metas.map((m) => ({
                value: m.id,
                label: m.nombre,
                emoji: emojiMeta(m.id, preferencias.emojis.metas),
                sub: `${money(m.progreso, m.moneda)} de ${money(m.montoObjetivo, m.moneda)}`,
              }))}
              onChange={setObjetivoId}
              boton={(abrir) => <Pastilla label={`🔍 Ver todas (${metas.length})`} enlace onPress={abrir} />}
            />
          )}
          <Pastilla label="➕ Nueva meta" enlace onPress={nuevaMeta} />
        </View>
      </View>

      {meta && (
        <>
          {/* G35: la meta y cómo queda, en vivo: llevas + ahorras = quedarías en. */}
          <BandaDetalle
            color={c.primary}
            titulo={`${emojiMeta(meta.id, preferencias.emojis.metas)} Llevas`}
            monto={money(meta.progreso, meta.moneda)}
            sub={`${porcentaje(meta.progresoPorcentaje)} de ${money(meta.montoObjetivo, meta.moneda)}${cuentaMeta ? ` · se guarda en ${nombre(cuentaMeta)}` : ''}`}
          >
            {total > 0 ? (
              <Datos plano>
                <Dato etiqueta="🐷 Ahorras" valor={`+ ${money(total, meta.moneda)}`} />
                <Dato etiqueta="✅ Quedarías en" valor={money(meta.progreso + total, meta.moneda)} />
              </Datos>
            ) : null}
          </BandaDetalle>

          {verParte && (
            <Elegir
              label="¿Para qué parte de la meta?"
              value={parteId ?? asignaciones[0].id}
              options={asignaciones.map((a) => ({ value: a.id, label: a.nombre }))}
              onChange={(v) => v && setParteId(v)}
            />
          )}

          {verCuentaMeta && (
            <Elegir
              label="¿En qué cuenta guardas la plata de esta meta?"
              placeholder="Elegir cuenta"
              value={destinoElegido}
              options={enMoneda.map((x) => ({ value: x.id, label: x.nombre }))}
              onChange={setDestinoElegido}
            />
          )}

          {meta && (ajena[meta.moneda] ?? 0) > 0 ? (
            <Nota>{`👥 ${money(ajena[meta.moneda], meta.moneda)} de tus cuentas son de otras personas: no los ahorres.`}</Nota>
          ) : null}

          {origenes.map((o, i) => {
            const usadas = new Set(origenes.filter((_, j) => j !== i).map((x) => x.cuentaId));
            return (
              <Panel key={i}>
                <Elegir
                  label={i === 0 ? '¿De dónde sale la plata?' : '¿De qué otra cuenta?'}
                  placeholder="Elegir cuenta"
                  value={o.cuentaId}
                  options={enMoneda.map((x) => {
                    const fr = libreDe(x.id);
                    return {
                      value: x.id,
                      label: x.id === destino && origenes.length > 1 ? `${x.nombre} (la cuenta de la meta)` : x.nombre,
                      sub: fr > 0 ? `Libre para ahorrar ${money(fr, x.moneda)}` : `Libre ${money(0, x.moneda)} · todo está en tus metas`,
                      deshabilitada: fr <= 0 || usadas.has(x.id),
                    };
                  })}
                  onChange={(v) => setOrigen(i, { cuentaId: v })}
                />
                {i === 0 && recordada && o.cuentaId === recordada ? (
                  <Nota>🔁 La de tu último ahorro para esta meta. Tócala para cambiarla.</Nota>
                ) : null}
                {o.cuentaId && (
                  <View style={styles.monto}>
                    <AmountInput
                      label="¿Cuánto?"
                      value={o.monto}
                      onChange={(v) => setOrigen(i, { monto: v })}
                      moneda={meta.moneda}
                      error={
                        Number(o.monto) > libreDe(o.cuentaId) + 1e-9
                          ? `${nombre(o.cuentaId)} solo tiene ${money(libreDe(o.cuentaId), meta.moneda)} libre.`
                          : undefined
                      }
                    />
                    <View style={styles.chips}>
                      <Chip
                        label={`💯 Todo lo libre (${money(libreDe(o.cuentaId), meta.moneda)})`}
                        onPress={() => setOrigen(i, { monto: String(libreDe(o.cuentaId)) })}
                      />
                      {origenes.length > 1 && (
                        <Chip label="✕ Quitar" onPress={() => setOrigenes((xs) => xs.filter((_, j) => j !== i))} />
                      )}
                    </View>
                  </View>
                )}
              </Panel>
            );
          })}

          {origenes.length < enMoneda.length && (
            <View style={styles.chips}>
              <Pastilla
                label="➕ Sumar otra cuenta"
                onPress={() => setOrigenes((xs) => [...xs, { cuentaId: null, monto: '' }])}
              />
            </View>
          )}

        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    monto: { gap: 8 },
    grupo: { gap: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
