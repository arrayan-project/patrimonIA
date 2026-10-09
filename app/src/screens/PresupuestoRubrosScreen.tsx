import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type CategoriaMovimientoDTO,
  type HogarDTO,
  type ObjetivoFinancieroDTO,
  type PresupuestoDTO,
  type PresupuestoLineaAhorroDTO,
  type PresupuestoLineaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { money } from '../format';
import { emojiCategoria, emojiMeta } from '../emojis';
import { usePreferencias } from '../preferencias';
import { Text } from '../ui/Text';
import { Button, Dato, Datos, ErrorText, MontoFila, Nota, Panel, Screen, Section, Skeleton, useC } from '../ui';

/**
 * Editor de las líneas del presupuesto por rubro (una por categoría del hogar).
 * G35: arriba, la resta en vivo (pensabas gastar − repartido = sin repartir).
 */
export function PresupuestoRubrosScreen() {
  const c = useC();
  const { token } = useSession();
  const { preferencias } = usePreferencias();
  const nav = useNav();
  const toast = useToast();
  const presupuestoId = nav.route.params?.presupuestoId as string;

  const [presu, setPresu] = useState<PresupuestoDTO | null>(null);
  const [cats, setCats] = useState<CategoriaMovimientoDTO[] | null>(null);
  // categoriaId → monto canónico ('' = sin línea)
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[]>([]);
  const [montosAhorro, setMontosAhorro] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const p = await api.get<PresupuestoDTO>(`/presupuestos/${presupuestoId}`, token);
      setPresu(p);
      let hogarId = p.hogarId;
      if (!hogarId) {
        const hogares = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
        hogarId = hogares[0]?.id ?? null;
      }
      const [lista, lineas, objs, lineasAhorro] = await Promise.all([
        hogarId
          ? api.get<CategoriaMovimientoDTO[]>(`/hogares/${hogarId}/categorias-movimiento`, token)
          : Promise.resolve<CategoriaMovimientoDTO[]>([]),
        api.get<PresupuestoLineaDTO[]>(`/presupuestos/${presupuestoId}/lineas`, token),
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token).catch(() => []),
        api
          .get<PresupuestoLineaAhorroDTO[]>(`/presupuestos/${presupuestoId}/lineas-ahorro`, token)
          .catch(() => []),
      ]);
      setCats(lista);
      const prev: Record<string, string> = {};
      for (const l of lineas) prev[l.categoriaId] = String(l.montoEsperado);
      setMontos(prev);
      setObjetivos(objs.filter((o) => o.estado === 'EN_PROGRESO'));
      const prevA: Record<string, string> = {};
      for (const l of lineasAhorro) prevA[l.objetivoId] = String(l.montoEsperado);
      setMontosAhorro(prevA);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [presupuestoId, token]);

  useCargaAlEnfocar(cargar);

  const guardar = async () => {
    setBusy(true);
    setError('');
    try {
      const lineas = Object.entries(montos)
        .map(([categoriaId, v]) => ({ categoriaId, montoEsperado: Number(v || '0') }))
        .filter((l) => l.montoEsperado > 0);
      await api.post('/comandos/DefinirLineasPresupuesto', { presupuestoId, lineas }, token);
      const lineasAhorro = Object.entries(montosAhorro)
        .map(([objetivoId, v]) => ({ objetivoId, montoEsperado: Number(v || '0') }))
        .filter((l) => l.montoEsperado > 0);
      await api.post(
        '/comandos/DefinirLineasAhorroPresupuesto',
        { presupuestoId, lineas: lineasAhorro },
        token,
      );
      toast.mostrar('Rubros guardados');
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (cats === null) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const gastos = cats.filter((x) => x.tipoAplicable !== 'INGRESO');
  const ingresos = cats.filter((x) => x.tipoAplicable === 'INGRESO');
  const total = (arr: CategoriaMovimientoDTO[]) => arr.reduce((s, x) => s + Number(montos[x.id] || '0'), 0);
  const moneda = presu?.moneda ?? 'CLP';
  const pensado = presu?.gastosEsperados ?? 0;
  const repartido = total(gastos);
  const sinRepartir = pensado - repartido;
  const conTotal = (n: number) => (n > 0 ? ` · ${money(n, moneda)}` : '');

  const grupo = (arr: CategoriaMovimientoDTO[]) => (
    <Panel>
      {arr.map((x) => (
        <MontoFila
          key={x.id}
          emoji={emojiCategoria(x) ?? '🏷️'}
          label={x.nombre}
          value={montos[x.id] ?? ''}
          onChange={(v) => setMontos((m) => ({ ...m, [x.id]: v }))}
        />
      ))}
    </Panel>
  );

  return (
    <Screen
      onRefresh={cargar}
      pie={
        <Button
          title="🧩 Guardar reparto"
          onPress={guardar}
          loading={busy}
          disabled={cats.length === 0 && objetivos.length === 0}
        />
      }
    >
      {pensado > 0 && (
        <Datos>
          <Dato etiqueta="🎯 Pensabas gastar" valor={money(pensado, moneda)} />
          <Dato etiqueta="🧩 Repartido" valor={`− ${money(repartido, moneda)}`} />
          <Dato
            etiqueta={sinRepartir >= 0 ? '❓ Sin repartir' : '⚠️ Repartiste de más'}
            valor={
              <Text style={{ fontSize: 14, fontWeight: '700', color: sinRepartir >= 0 ? c.text : c.danger }}>
                {money(Math.abs(sinRepartir), moneda)}
              </Text>
            }
          />
        </Datos>
      )}

      {gastos.length > 0 && <Section title="🧾 Gastos">{grupo(gastos)}</Section>}
      {ingresos.length > 0 && <Section title={`📥 Lo que esperas que entre${conTotal(total(ingresos))}`}>{grupo(ingresos)}</Section>}

      {objetivos.length > 0 && (
        <Section
          title={`🐷 Ahorro para metas${conTotal(objetivos.reduce((s, o) => s + Number(montosAhorro[o.id] || '0'), 0))}`}
        >
          <Panel>
            {objetivos.map((o) => (
              <MontoFila
                key={o.id}
                emoji={emojiMeta(o.id, preferencias.emojis.metas)}
                label={o.nombre}
                value={montosAhorro[o.id] ?? ''}
                onChange={(v) => setMontosAhorro((m) => ({ ...m, [o.id]: v }))}
              />
            ))}
          </Panel>
        </Section>
      )}

      {cats.length === 0 && <Nota>Este hogar no tiene categorías. Créalas en Ajustes → Para ordenar tu plata.</Nota>}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
