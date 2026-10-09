import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type EntradaHistorialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { NOMBRE_CATEGORIA_FUNCIONAL } from '../emojis';
import {
  accionAuditoria,
  EmptyState,
  ErrorText,
  etiqueta,
  fechaLegible,
  fechaRelativa,
  humanizar,
  Migaja,
  Panel,
  Screen,
  Skeleton,
  useC,
  type Paleta,
  tipoDe,
} from '../ui';

const CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  tipo: 'Tipo',
  visibilidad: 'Qué comparte',
  estado: 'Estado',
  participa_consolidacion: 'Suma al hogar',
  categoria_funcional: 'Qué es',
  valor_inicial: 'Con cuánto empezó',
  valor_pendiente: 'Lo que se debe',
  valor_vigente: 'Valor',
  moneda: 'Moneda',
  propietarios: 'De quién es',
  monto: 'Monto',
  monto_objetivo: 'Monto de la meta',
  objetivo_financiero_id: 'Meta',
  progreso: 'Avance',
  fecha: 'Fecha',
  fecha_baja: 'Desde cuándo',
  fecha_alta: 'Desde cuándo la tiene',
  persona: 'Persona',
  direccion: 'Hacia dónde',
  niveles: 'Qué comparte',
  compartido_con: 'Con quiénes',
  compartidoCon: 'Con quiénes',
  admite_valorizacion: 'Cambia de valor',
  admiteValorizacion: 'Cambia de valor',
};
/** Qué se comparte (visibilidad por tipo de información). */
const QUE_INFO: Record<string, string> = { EXISTENCIA: 'que existe', VALOR: 'cuánto tiene', MOVIMIENTOS: 'movimientos' };
const QUIEN_VE: Record<string, string> = { PRIVADA: 'solo tú', FAMILIAR: 'el hogar', COMPARTIDA: 'algunos' };
const CAMPOS_MONTO = new Set(['valor_inicial', 'valor_pendiente', 'valor_vigente', 'monto', 'monto_objetivo']);

/** G35: emoji de cada acción del historial. */
function emojiAccion(comando: string): string {
  if (comando === 'CrearReserva') return '🐷';
  if (comando === 'LiberarReserva') return '💸';
  if (comando === 'CompletarObjetivo') return '🎉';
  if (comando === 'CondonarDeuda') return '🤝';
  if (comando === 'DeclararIncobrable') return '❌';
  if (/^(Registrar|Crear)/.test(comando)) return '✨';
  if (/^Eliminar/.test(comando)) return '🗑️';
  if (/^Desactivar/.test(comando)) return '📦';
  if (/^Reactivar/.test(comando)) return '♻️';
  return '✏️';
}

/**
 * Un valor tal como lo ve una persona: los montos con su moneda, los textos
 * como se escribieron ("Fondo mutuo Fintual", "CLP") y solo los códigos
 * internos (`EN_PROGRESO`, `ACTIVO`) pasados a palabras.
 */
function valor(k: string, v: unknown, moneda: string | undefined, yo: string): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return CAMPOS_MONTO.has(k) && moneda ? money(v, moneda) : v.toLocaleString('es-CL');
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return fechaLegible(v);
    if (k === 'categoria_funcional') return NOMBRE_CATEGORIA_FUNCIONAL[v] ?? etiqueta(v);
    // Códigos internos: con guion bajo o de 4+ mayúsculas (un código de moneda, "CLP", queda tal cual).
    const enDiccionario = etiqueta(v) !== humanizar(v);
    return enDiccionario || /^[A-Z]{4,}(_[A-Z]+)*$|^[A-Z]+(_[A-Z]+)+$/.test(v) ? etiqueta(v) : v;
  }
  if (Array.isArray(v)) {
    if (k === 'propietarios')
      return v
        .map((p: { usuario_id?: string; usuarioId?: string; porcentaje?: number }) =>
          `${(p.usuario_id ?? p.usuarioId) === yo ? 'Tú' : 'Otra persona'} ${p.porcentaje ?? '?'}%`,
        )
        .join(' · ');
    if (v.length === 0) return 'nadie';
    return `${v.length} ${v.length === 1 ? 'persona' : 'personas'}`;
  }
  if (typeof v === 'object') {
    if (Object.keys(v as object).length === 0) return '—';
    return Object.entries(v as Record<string, unknown>)
      .map(([q, quien]) => `${QUE_INFO[q] ?? humanizar(q)}: ${QUIEN_VE[String(quien)] ?? etiqueta(String(quien))}`)
      .join(' · ');
  }
  return String(v);
}

/** Lo que cambió: "Nombre: A → B", o solo "Nombre: B" si antes no había nada. */
function cambios(e: EntradaHistorialDTO, yo: string): string[] {
  const a = e.valorAnterior ?? {};
  const d = e.valorPosterior ?? {};
  const moneda = (d.moneda ?? a.moneda) as string | undefined;
  const claves = [...new Set([...Object.keys(a), ...Object.keys(d)])];
  return claves.flatMap((k) => {
    const antes = valor(k, a[k], moneda, yo);
    const despues = valor(k, d[k], moneda, yo);
    if (antes === despues) return [];
    const campo = CAMPO[k] ?? humanizar(k);
    return [antes === '—' ? `${campo}: ${despues}` : `${campo}: ${antes} → ${despues}`];
  });
}

/** A5 — "¿Quién cambió esto?": historial de auditoría de una entidad. */
export function HistorialScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const nav = useNav();
  const entidadTipo = nav.route.params?.entidadTipo as string;
  const entidadId = nav.route.params?.entidadId as string;
  const contexto = nav.route.params?.contexto as string | undefined;

  const [entradas, setEntradas] = useState<EntradaHistorialDTO[] | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setEntradas(
        await api.get<EntradaHistorialDTO[]>(
          `/historial?entidadTipo=${entidadTipo}&entidadId=${entidadId}`,
          token,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [entidadTipo, entidadId, token]);

  useCargaAlEnfocar(cargar);

  if (!entradas) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      {entradas.length === 0 ? (
        <EmptyState emoji="🕓" titulo="Aún no hay cambios" />
      ) : (
        <Panel gap={0}>
          {entradas.map((e, i) => {
            const difs = cambios(e, usuario.id);
            return (
              <View key={e.id} style={[styles.item, i > 0 && styles.sep]}>
                <View style={styles.emoji}>
                  <Text style={styles.emojiTxt}>{emojiAccion(e.comando)}</Text>
                </View>
                <View style={styles.cuerpo}>
                  <Text style={styles.accion}>{accionAuditoria(e.comando)}</Text>
                  <Text style={styles.meta}>
                    {e.usuarioId === usuario.id ? 'Tú' : e.usuarioNombre} · {fechaRelativa(e.fecha)}
                  </Text>
                  {e.motivo ? <Text style={styles.motivo}>📝 “{e.motivo}”</Text> : null}
                  {difs.map((d) => (
                    <Text key={d} style={styles.cambio}>
                      {d}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </Panel>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  emoji: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.panelAlt, alignItems: 'center', justifyContent: 'center' },
  emojiTxt: { fontSize: 20 },
  cuerpo: { flex: 1, gap: 2 },
  sep: { borderTopWidth: 1, borderTopColor: c.faint },
  accion: { ...tipoDe(c).dato, fontSize: 15 },
  meta: tipoDe(c).nota,
  motivo: { ...tipoDe(c).nota, fontStyle: 'italic', marginTop: 2 },
  cambio: { fontSize: 13, color: c.muted, marginTop: 2 },
});
