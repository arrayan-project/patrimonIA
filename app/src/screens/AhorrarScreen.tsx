import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type ObjetivoFinancieroDTO,
  type PatrimonioIndividualDTO,
  type ReservaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { money, porcentaje } from '../format';
import { emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { useToast } from '../ui/Toast';
import {
  AmountInput,
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
  Screen,
  Skeleton,
  useC,
  type Paleta,
} from '../ui';

type Origen = { cuentaId: string | null; monto: string };

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

  const sucio = origenes.some((o) => o.cuentaId || o.monto);
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  useEffect(() => {
    Promise.all([
      api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
      api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      api.get<{ elementoId: string; disponible: number }[]>('/usuarios/me/disponibilidad', token),
    ])
      .then(([objs, els, disp]) => {
        setMetas(objs.filter((o) => o.estado === 'EN_PROGRESO' && o.puedoModificar));
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
  }, [token]);

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
    if (!movidos.length) return '';
    return `🔁 Se mueven ${movidos.map((o) => `${money(Number(o.monto), meta.moneda)} de ${nombre(o.cuentaId)}`).join(' y ')} a ${nombre(destino)}.`;
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
        <Button title="Crear una meta" onPress={() => nav.go('MetaForm')} />
      </Screen>
    );
  }

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
      <Elegir
        label="¿Para qué meta?"
        placeholder="Elegir meta"
        value={objetivoId}
        options={metas.map((m) => ({
          value: m.id,
          label: m.nombre,
          sub: `${money(m.progreso, m.moneda)} de ${money(m.montoObjetivo, m.moneda)}`,
        }))}
        onChange={setObjetivoId}
      />

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
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
