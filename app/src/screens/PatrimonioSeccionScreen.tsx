import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AgrupacionDTO,
  type ElementoPatrimonialDTO,
  type ElementosDelHogarDTO,
  type SeriePatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { usePreferencias } from '../preferencias';
import { EMOJI_CATEGORIA_FUNCIONAL, emojiElemento, emojiMoneda, NOMBRE_CATEGORIA_FUNCIONAL } from '../emojis';
import {
  Button,
  CambioPeriodo,
  Dato,
  Datos,
  EmptyState,
  ErrorText,
  etiqueta,
  fechaLegible,
  GroupLabel,
  Hero,
  ListCard,
  MenuList,
  Panel,
  Pastilla,
  PillToggle,
  Screen,
  Section,
  Skeleton,
  TxRow,
  useC,
} from '../ui';
import { GraficoLinea } from '../ui/charts';

/** Orden de los grupos en "Tu plata" (igual que la composición de Inicio). */
const CATS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'CREDITO', 'DEUDA'] as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Título de un grupo: emoji y nombre sin jerga ("🏦 Cuentas"). */
const tituloCat = (cat: string) =>
  `${EMOJI_CATEGORIA_FUNCIONAL[cat] ?? '💼'} ${NOMBRE_CATEGORIA_FUNCIONAL[cat] ?? etiqueta(cat)}`;

/**
 * Sin `categoria`: "Tu plata" — todas las cuentas y bienes agrupados (Cuentas,
 * Ahorro, Inversiones, Bienes, Te deben, Deudas), con cómo cambió en el último
 * año arriba (G32 H-03/H-08; G35). Con `categoria`: solo ese grupo. Se llega
 * desde el Hero y la composición de Inicio.
 */
export function PatrimonioSeccionScreen() {
  const c = useC();
  const { token, usuario } = useSession();
  const { preferencias } = usePreferencias();
  const nav = useNav();
  const categoria = nav.route.params?.categoria as string | undefined;
  const alcance = (nav.route.params?.alcance as 'mios' | 'hogar' | undefined) ?? 'mios';
  const monedaPrin = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const hogarId = nav.route.params?.hogarId as string | undefined;
  useTitulo(alcance === 'hogar' ? 'Plata del hogar' : undefined);

  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [ocultosTodos, setOcultos] = useState<ElementosDelHogarDTO['ocultos']>([]);
  const [serie, setSerie] = useState<SeriePatrimonialDTO | null>(null);
  const [verDesactivadas, setVerDesactivadas] = useState(false);
  // G35: "Mis grupos" (agrupaciones, personales) como otra forma de ver Tu plata.
  const [grupos, setGrupos] = useState<AgrupacionDTO[]>([]);
  const [vista, setVista] = useState<'tipo' | 'grupos'>('tipo');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      // G37: en el hogar, lo mismo que suma su total (de todos, también lo tuyo);
      // lo que no puedes ver llega sumado aparte, para que la lista cuadre.
      let els: ElementoPatrimonialDTO[];
      if (alcance === 'hogar' && hogarId) {
        const r = await api.get<ElementosDelHogarDTO>(`/hogares/${hogarId}/elementos`, token);
        els = r.elementos;
        setOcultos(categoria ? r.ocultos.filter((o) => o.categoriaFuncional === categoria) : r.ocultos);
      } else {
        els = await api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me&incluirInactivos=true', token);
      }
      setElementos(categoria ? els.filter((e) => e.categoriaFuncional === categoria) : els);
      if (!categoria && alcance === 'mios') {
        setGrupos(
          (await api.get<AgrupacionDTO[]>('/usuarios/me/agrupaciones', token).catch(() => [])).sort(
            (a, b) => a.orden - b.orden,
          ),
        );
        const haceUnAnio = new Date(Date.now() - 365 * 86_400_000);
        setSerie(
          await api
            .get<SeriePatrimonialDTO>(`/usuarios/me/serie-patrimonial?desde=${iso(haceUnAnio)}&pasos=12`, token)
            .catch(() => null),
        );
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, categoria, alcance, hogarId]);

  useCargaAlEnfocar(cargar);

  if (!elementos) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const hogar = alcance === 'hogar';
  // Lo tuyo es tu parte de cada cuenta o bien (como en Inicio); en el hogar, el valor completo.
  const pctDe = (e: ElementoPatrimonialDTO) =>
    hogar ? 100 : (e.propietarios.find((p) => p.usuarioId === usuario.id)?.porcentaje ?? 100);
  const parte = (e: ElementoPatrimonialDTO) => (e.valorVigente * pctDe(e)) / 100;
  const activas = elementos.filter((e) => e.estado !== 'INACTIVO');
  const desactivadas = elementos.filter((e) => e.estado === 'INACTIVO');
  const ocultos = hogar ? ocultosTodos : [];
  // Cada cifra: lo que ves más lo que no ves (sumado aparte), para cuadrar con el total.
  const valores = (moneda: string) => [
    ...activas.filter((e) => e.moneda === moneda).map(parte),
    ...ocultos.filter((o) => o.moneda === moneda).map((o) => o.valor),
  ];
  const enMoneda = valores(monedaPrin);
  const subtotal = enMoneda.reduce((s, v) => s + v, 0);
  const tienes = enMoneda.reduce((s, v) => s + Math.max(v, 0), 0);
  const debes = enMoneda.reduce((s, v) => s + Math.max(-v, 0), 0);
  // Lo que está en otras monedas no se suma: se dice aparte, con su cifra.
  const otrasMonedas = [
    ...new Set([...activas.map((e) => e.moneda), ...ocultos.map((o) => o.moneda)].filter((m) => m !== monedaPrin)),
  ].map((m) => ({ moneda: m, total: valores(m).reduce((s, v) => s + v, 0) }));
  const ademas = otrasMonedas.length > 0 && (
    <Datos plano>
      {otrasMonedas.map((m) => (
        <Dato key={m.moneda} etiqueta={`${emojiMoneda(m.moneda)} Además, en ${m.moneda}`} valor={money(m.total, m.moneda)} />
      ))}
    </Datos>
  );

  const subtitulo = (el: ElementoPatrimonialDTO) => {
    if (pctDe(el) < 100) return `Tu parte: ${pctDe(el)}%`;
    const partes: string[] = [];
    // El tipo solo si dice algo que el nombre no dice ("Cuenta corriente · Cuenta corriente").
    if (sinTildes(etiqueta(el.tipo)) !== sinTildes(el.nombre)) partes.push(etiqueta(el.tipo));
    if (el.estadoOperativo === 'EN_MORA' || el.estadoOperativo === 'INCOBRABLE')
      partes.push(`⏰ ${etiqueta(el.estadoOperativo)}`);
    if (el.estado === 'INACTIVO') partes.push('Cerrada');
    return partes.join(' · ') || undefined;
  };

  const fila = (el: ElementoPatrimonialDTO) => (
    <TxRow
      key={el.id}
      title={el.nombre}
      subtitle={subtitulo(el)}
      amount={el.valorOculto ? '—' : money(parte(el), el.moneda)}
      negativo={!el.valorOculto && el.valorVigente < 0}
      logo={{ emoji: emojiElemento(el, preferencias.emojis.elementos) }}
      onPress={() => nav.go('ElementoDetalle', { elementoId: el.id })}
    />
  );

  // G37: lo que suma al hogar pero su dueño no comparte, en una fila por grupo y moneda.
  const filasOcultas = (cat: string) =>
    ocultos
      .filter((o) => o.categoriaFuncional === cat)
      .map((o) => (
        <TxRow
          key={`oculto-${cat}-${o.moneda}`}
          title={o.cantidad === 1 ? 'Una que no puedes ver' : `${o.cantidad} que no puedes ver`}
          subtitle={o.cantidad === 1 ? 'Su dueño no la comparte' : 'Sus dueños no las comparten'}
          amount={money(o.valor, o.moneda)}
          negativo={o.valor < 0}
          logo={{ emoji: '🔒' }}
        />
      ));

  const grupoDesactivadas = desactivadas.length > 0 && (
    <View style={{ gap: 8 }}>
      <Pastilla
        label={verDesactivadas ? `🗄️ Ocultar cerradas` : `🗄️ Ver cerradas (${desactivadas.length})`}
        onPress={() => setVerDesactivadas((v) => !v)}
      />
      {verDesactivadas && <ListCard>{desactivadas.map(fila)}</ListCard>}
    </View>
  );

  const agregar = !hogar && (
    <Button title="➕ Agregar cuenta o bien" variant="secondary" onPress={() => nav.go('AgregarElemento')} />
  );

  // Un bloque con título, subtotal (en la moneda principal) y sus filas.
  const bloque = (key: string, titulo: string, els: ElementoPatrimonialDTO[]) => (
    <View key={key} style={{ gap: 8 }}>
      <GroupLabel
        right={
          <Text style={{ color: c.muted, fontWeight: '700' }}>
            {money(els.filter((e) => e.moneda === monedaPrin).reduce((s, e) => s + parte(e), 0), monedaPrin)}
          </Text>
        }
      >
        {titulo}
      </GroupLabel>
      <ListCard>{els.map(fila)}</ListCard>
    </View>
  );
  const porGrupo = () => {
    const enAlguno = new Set(grupos.flatMap((g) => g.elementoIds));
    const sinGrupo = activas.filter((e) => !enAlguno.has(e.id));
    return [
      ...grupos.map((g) => {
        const els = activas.filter((e) => g.elementoIds.includes(e.id));
        return els.length > 0 ? bloque(g.id, `🗂️ ${g.nombre}`, els) : null;
      }),
      sinGrupo.length > 0 ? bloque('sin-grupo', '📦 Sin grupo', sinGrupo) : null,
    ];
  };
  const armarGrupos = !hogar && (
    <MenuList
      items={[
        {
          title: grupos.length > 0 ? 'Mis grupos' : 'Armar mis grupos',
          subtitle: grupos.length > 0 ? 'Crear, cambiar o borrar grupos' : "Junta cuentas, como 'Jubilación'",
          emoji: '🗂️',
          onPress: () => nav.go('Agrupaciones'),
        },
      ]}
    />
  );

  if (!categoria) {
    const puntos = (serie?.puntos ?? []).map((p) => ({
      etiqueta: fechaLegible(p.fecha),
      valor: p.porMoneda.find((m) => m.moneda === monedaPrin)?.patrimonio ?? 0,
    }));
    return (
      <Screen onRefresh={cargar}>
        <Hero
          label={hogar ? 'Plata del hogar' : 'Tu plata en total'}
          value={money(subtotal, monedaPrin)}
          substats={[
            { label: hogar ? '💰 Tienen' : '💰 Tienes', value: money(tienes, monedaPrin) },
            { label: hogar ? '💳 Deben' : '💳 Debes', value: money(debes, monedaPrin) },
          ]}
          debajo={ademas || undefined}
        />

        {puntos.length >= 2 && (
          <Section title="📈 Cómo ha cambiado" accion="Ver más" onAccion={() => nav.go('EvolucionPatrimonio')}>
            <Panel>
              <GraficoLinea puntos={puntos} />
              <CambioPeriodo
                etiquetaAntes="🗓️ Hace un año"
                antes={puntos[0].valor}
                hoy={puntos[puntos.length - 1].valor}
                formato={(n) => money(n, monedaPrin)}
              />
            </Panel>
          </Section>
        )}

        {elementos.length === 0 && ocultos.length === 0 ? (
          <EmptyState
            emoji="👛"
            titulo="Aún no tienes cuentas ni bienes"
            descripcion={hogar ? undefined : 'Agrega tu primera cuenta, inversión o deuda.'}
            accion={hogar ? undefined : 'Agregar cuenta o bien'}
            onAccion={hogar ? undefined : () => nav.go('AgregarElemento')}
          />
        ) : (
          <>
            {grupos.length > 0 && (
              <PillToggle
                options={['tipo', 'grupos'] as const}
                value={vista}
                onChange={setVista}
                format={(v) => (v === 'tipo' ? '🏦 Por tipo' : '🗂️ Mis grupos')}
              />
            )}
            {grupos.length > 0 && vista === 'grupos' ? porGrupo() : CATS.map((cat) => {
              const delCat = activas.filter((e) => e.categoriaFuncional === cat);
              const ocultasCat = ocultos.filter((o) => o.categoriaFuncional === cat);
              if (delCat.length === 0 && ocultasCat.length === 0) return null;
              const sub =
                delCat.filter((e) => e.moneda === monedaPrin).reduce((s, e) => s + parte(e), 0) +
                ocultasCat.filter((o) => o.moneda === monedaPrin).reduce((s, o) => s + o.valor, 0);
              return (
                <View key={cat} style={{ gap: 8 }}>
                  <GroupLabel right={<Text style={{ color: c.muted, fontWeight: '700' }}>{money(sub, monedaPrin)}</Text>}>
                    {tituloCat(cat)}
                  </GroupLabel>
                  <ListCard>
                    {delCat.map(fila)}
                    {filasOcultas(cat)}
                  </ListCard>
                </View>
              );
            })}
            {grupoDesactivadas}
            {agregar}
            {armarGrupos}
          </>
        )}

        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  // §G28 — en DEUDA/CREDITO separamos las financieras de los encargos/custodia.
  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';
  const custodia = esDeudaOCredito ? activas.filter((e) => e.naturaleza === 'CUSTODIA_INFORMAL') : [];
  const financieras = esDeudaOCredito ? activas.filter((e) => e.naturaleza !== 'CUSTODIA_INFORMAL') : activas;

  return (
    <Screen onRefresh={cargar}>
      <Hero label={tituloCat(categoria)} value={money(subtotal, monedaPrin)} debajo={ademas || undefined} />

      {elementos.length === 0 && ocultos.length === 0 ? (
        <EmptyState
          emoji={EMOJI_CATEGORIA_FUNCIONAL[categoria] ?? '👛'}
          titulo={`Aún no tienes nada en ${NOMBRE_CATEGORIA_FUNCIONAL[categoria] ?? etiqueta(categoria)}`}
          descripcion={hogar ? undefined : 'Agrega uno para verlo acá.'}
          accion={hogar ? undefined : 'Agregar cuenta o bien'}
          onAccion={hogar ? undefined : () => nav.go('AgregarElemento')}
        />
      ) : (
        <>
          {custodia.length > 0 ? (
            <>
              {(financieras.length > 0 || ocultos.length > 0) && (
                <>
                  <GroupLabel>🏦 Con bancos y personas</GroupLabel>
                  <ListCard>
                    {financieras.map(fila)}
                    {filasOcultas(categoria)}
                  </ListCard>
                </>
              )}
              <GroupLabel>📦 Encargos y plata de otros</GroupLabel>
              <ListCard>{custodia.map(fila)}</ListCard>
            </>
          ) : (
            (financieras.length > 0 || ocultos.length > 0) && (
              <ListCard>
                {financieras.map(fila)}
                {filasOcultas(categoria)}
              </ListCard>
            )
          )}
          {grupoDesactivadas}
          {agregar}
        </>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
