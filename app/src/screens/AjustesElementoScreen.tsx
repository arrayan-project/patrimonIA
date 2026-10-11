import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type MiembroDTO,
  type ObjetivoFinancieroDTO,
} from '../api/client';
import { View } from 'react-native';
import { Text } from '../ui/Text';
import { useSession } from '../auth/AuthContext';
import { aplicarRespuestas } from '../compartirHogar';
import { esAMedida, guardadoDe, respuestasDe, type Respuestas } from '../compartirPreguntas';
import { cuentasDelDia } from '../fotoMes';
import { PreguntasCompartir } from './CompartirConHogar';
import { useNav, useTitulo } from '../navigation/navigator';
import { emojiElemento } from '../emojis';
import { money } from '../format';
import { conEmoji, usePreferencias } from '../preferencias';
import {
  Elegir,
  ElegirEmoji,
  ElegirVarios,
  ErrorText,
  ListCard,
  Nota,
  Opcional,
  Pastilla,
  Screen,
  Section,
  Segmented,
  Skeleton,
  useC,
  useGuardarAlInstante,
} from '../ui';

const VIS = ['PRIVADA', 'FAMILIAR', 'COMPARTIDA'] as const;
type Nivel = (typeof VIS)[number];
const TIPOS_INFO = [
  ['EXISTENCIA', '¿Quién ve que existe?'],
  ['VALOR', '¿Quién ve el monto?'],
  ['MOVIMIENTOS', '¿Quién ve los movimientos?'],
] as const;
const NOMBRE_VIS: Record<Nivel, string> = { PRIVADA: 'Solo tú', FAMILIAR: 'El hogar', COMPARTIDA: 'Algunos' };

/**
 * Ajustes de una cuenta o bien (plantillas de pantalla, R4b, plantilla
 * Ajustes): qué se comparte con el hogar y si se valoriza. Todo se guarda al
 * tocarlo; si falla, se revierte y avisa. Sin botón Guardar.
 */
export function AjustesElementoScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const guardar = useGuardarAlInstante();
  const c = useC();
  const { preferencias, guardarPreferencias } = usePreferencias();
  const elementoId = nav.route.params?.elementoId as string;

  const [el, setEl] = useState<ElementoPatrimonialDTO | null>(null);
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  // Bloque M: las metas (para "🎯 ¿Esta cuenta es para una meta?") y el cambio pendiente de confirmar.
  const [metas, setMetas] = useState<ObjetivoFinancieroDTO[]>([]);
  const [cambioMeta, setCambioMeta] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setEl(await api.get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token));
      setMetas(await api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token).catch(() => []));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, token]);

  useEffect(() => {
    void cargar();
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then(async (hs) => (hs[0] ? (await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token)).miembros : []))
      .then((ms) => setMiembros((ms ?? []).filter((m) => m.usuarioId !== usuario.id)))
      .catch(() => setMiembros([]));
  }, [cargar, token, usuario.id]);

  useTitulo(el ? `Ajustes de ${el.nombre}` : undefined);

  /** Aplica en pantalla al instante; si el comando falla, vuelve a lo que había y avisa. */
  const aplicar = async (optimista: ElementoPatrimonialDTO, fn: () => Promise<unknown>) => {
    const antes = el;
    setEl(optimista);
    if (await guardar(fn, () => setEl(antes))) await cargar();
  };

  if (!el) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const pareja = miembros.length === 1 ? miembros[0].nombre : undefined;
  const respuestas = respuestasDe(el);
  // Bloque M (M-5): solo cuentas, ahorros e inversiones activas.
  const dedicable = ['LIQUIDEZ', 'RESERVA', 'INVERSION'].includes(el.categoriaFuncional) && el.estado === 'ACTIVO';
  const metaActual = metas.find((m) => (m.cuentasDedicadas ?? []).some((d) => d.elementoId === el.id)) ?? null;
  const metasPosibles = metas.filter((m) => m.estado === 'EN_PROGRESO' && m.puedoModificar && m.moneda === el.moneda);
  const NINGUNA = 'ninguna';
  const dedicarA = (objetivoId: string) =>
    guardar(
      () => api.post('/comandos/DedicarCuentaAObjetivo', { objetivoId, elementoId: el.id }, token),
      () => undefined,
    ).then(() => cargar());
  const cambiarDeMeta = async (conservarComoApartado: boolean) => {
    if (!metaActual || !cambioMeta) return;
    const destino = cambioMeta;
    setCambioMeta(null);
    const ok = await guardar(
      () =>
        api.post(
          '/comandos/QuitarCuentaDeObjetivo',
          { objetivoId: metaActual.id, elementoId: el.id, conservarComoApartado },
          token,
        ),
      () => undefined,
    );
    if (ok && destino !== NINGUNA) await dedicarA(destino);
    else await cargar();
  };
  // Bloque S: guardar las respuestas (optimista: la pantalla ya muestra lo nuevo).
  const responder = (r: Respuestas) => {
    const g = guardadoDe(r);
    void aplicar({ ...el, participaConsolidacion: g.consolida, visibilidadPorTipo: g.niveles }, () =>
      aplicarRespuestas(token, elementoId, r, el.participaConsolidacion),
    );
  };
  const vpt = (el.visibilidadPorTipo ?? {
    EXISTENCIA: el.visibilidad,
    VALOR: el.visibilidad,
    MOVIMIENTOS: el.visibilidad,
  }) as Record<'EXISTENCIA' | 'VALOR' | 'MOVIMIENTOS', Nivel>;
  const esDeudaOCredito = el.categoriaFuncional === 'DEUDA' || el.categoriaFuncional === 'CREDITO';

  const definirVisibilidad = (niveles: typeof vpt, compartidoCon: string[]) =>
    aplicar({ ...el, visibilidadPorTipo: niveles, compartidoCon }, () =>
      api.post('/comandos/DefinirVisibilidadElementoPatrimonial', { elementoId, niveles, compartidoCon }, token),
    );

  return (
    <Screen>
      <Section title="🎨 Cómo se ve">
        <ListCard>
          <ElegirEmoji
            value={emojiElemento(el, preferencias.emojis.elementos)}
            onChange={(e) =>
              // guardarPreferencias ya vuelve atrás si falla.
              void guardar(() => guardarPreferencias(conEmoji(preferencias, 'elementos', el.id, e)), () => undefined)
            }
          />
        </ListCard>
      </Section>
      {/* Bloque S: con un solo miembro en el hogar, no hay con quién compartir. */}
      {miembros.length > 0 && (
        <Section title="👥 Con el hogar">
          <PreguntasCompartir
            categoriaFuncional={el.categoriaFuncional}
            respuestas={respuestas}
            onChange={responder}
            pareja={pareja}
            delDiaADia={cuentasDelDia([el], preferencias.mes.cuentas).includes(el.id)}
            cuentaActual={el}
            cuenta={{ nombre: el.nombre, saldo: money(el.valorPendiente ?? el.valorVigente, el.moneda) }}
            yo={usuario.nombre.split(' ')[0]}
          />
        </Section>
      )}

      {/* Bloque M: "🏦 Esta cuenta es para esta meta", también desde la cuenta. */}
      {dedicable && (metaActual || metasPosibles.length > 0) && (
        <Section title="🎯 Para una meta">
          <Elegir
            label="🎯 ¿Esta cuenta es para una meta?"
            value={cambioMeta ?? metaActual?.id ?? NINGUNA}
            options={[
              { value: NINGUNA, label: 'No, es para cualquier cosa' },
              ...metasPosibles.map((m) => ({ value: m.id, label: `🎯 ${m.nombre}`, sub: 'Toda la cuenta es para esta meta' })),
            ]}
            onChange={(v) => {
              if (!v || v === (metaActual?.id ?? NINGUNA)) return;
              if (metaActual) setCambioMeta(v);
              else void dedicarA(v);
            }}
          />
          {metaActual && cambioMeta && (
            <View style={{ gap: 10 }}>
              {/* Juan (2026-10-11): se pregunta, sin opción preelegida. */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                {`¿Dejar lo que tiene (${money(el.valorVigente, el.moneda)}) apartado para ${metaActual.nombre}?`}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pastilla label="🐷 Sí, dejarlo apartado" onPress={() => void cambiarDeMeta(true)} />
                <Pastilla label="No, que quede libre" onPress={() => void cambiarDeMeta(false)} />
                <Pastilla label="Cancelar" onPress={() => setCambioMeta(null)} />
              </View>
            </View>
          )}
        </Section>
      )}

      {!esDeudaOCredito && (
        <Section title="📈 Su valor">
          <Segmented
            label="¿Su valor cambia con el tiempo?"
            options={['No', 'Sí'] as const}
            value={el.admiteValorizacion ? 'Sí' : 'No'}
            formatearOpcion={(v) => v}
            onChange={(v) =>
              aplicar({ ...el, admiteValorizacion: v === 'Sí' }, () =>
                api.post('/comandos/CambiarAdmiteValorizacion', { elementoId, admite: v === 'Sí' }, token),
              )
            }
          />
          <Nota>Para casas, autos o inversiones: te deja anotar cuánto valen.</Nota>
        </Section>
      )}

      <Opcional emoji="⚙️" titulo="Más opciones" abierto={esAMedida(el)}>
        <Section title="⚙️ Más opciones">
          {TIPOS_INFO.map(([k, pregunta]) => (
            <Segmented
              key={k}
              label={pregunta}
              options={VIS}
              value={vpt[k]}
              formatearOpcion={(v) => NOMBRE_VIS[v]}
              onChange={(v) => definirVisibilidad({ ...vpt, [k]: v }, el.compartidoCon ?? [])}
            />
          ))}
          {miembros.length > 0 && Object.values(vpt).includes('COMPARTIDA') && (
            <ElegirVarios
              label="¿Con quiénes?"
              values={el.compartidoCon ?? []}
              onChange={(ids) => definirVisibilidad(vpt, ids)}
              options={miembros.map((m) => ({ value: m.usuarioId, label: m.nombre }))}
            />
          )}
          <Segmented
            label="¿Suma al patrimonio del hogar?"
            options={['No', 'Sí'] as const}
            value={el.participaConsolidacion ? 'Sí' : 'No'}
            formatearOpcion={(v) => v}
            onChange={(v) =>
              aplicar({ ...el, participaConsolidacion: v === 'Sí' }, () =>
                api.post('/comandos/CambiarParticipacionEnConsolidacion', { elementoId, participa: v === 'Sí' }, token),
              )
            }
          />
        </Section>
      </Opcional>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
