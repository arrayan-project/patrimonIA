import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type EntradaHistorialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import {
  accionAuditoria,
  EmptyState,
  ErrorText,
  etiqueta,
  fechaRelativa,
  Migaja,
  Nota,
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
  visibilidad: 'Visibilidad',
  estado: 'Estado',
  participa_consolidacion: 'Cuenta en el patrimonio del hogar',
  categoria_funcional: 'Categoría',
  valor_inicial: 'Saldo al agregarlo',
  valor_pendiente: 'Saldo pendiente',
  valor_vigente: 'Valor vigente',
  moneda: 'Moneda',
  propietarios: 'Propietarios',
  monto: 'Monto',
  monto_objetivo: 'Monto de la meta',
  objetivo_financiero_id: 'Meta asociada',
  progreso: 'Progreso',
};

function valor(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return v.toLocaleString('es-CL');
  if (typeof v === 'string') return etiqueta(v);
  if (Array.isArray(v)) return `${v.length} ítem${v.length === 1 ? '' : 's'}`;
  return JSON.stringify(v);
}

function cambios(e: EntradaHistorialDTO): { campo: string; antes: string; despues: string }[] {
  const a = e.valorAnterior ?? {};
  const d = e.valorPosterior ?? {};
  const claves = [...new Set([...Object.keys(a), ...Object.keys(d)])];
  return claves.map((k) => ({
    campo: CAMPO[k] ?? k.replace(/_/g, ' '),
    antes: valor(a[k]),
    despues: valor(d[k]),
  }));
}

/** A5 — "¿Quién cambió esto?": historial de auditoría de una entidad. */
export function HistorialScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
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
      <Nota>Quién hizo cada cambio y cuándo. No se puede editar ni borrar.</Nota>

      {entradas.length === 0 ? (
        <EmptyState icon="time-outline" titulo="Sin cambios registrados" />
      ) : (
        <Panel gap={0}>
          {entradas.map((e, i) => {
            const difs = cambios(e).filter((d) => d.antes !== d.despues);
            return (
              <View key={e.id} style={[styles.item, i > 0 && styles.sep]}>
                <Text style={styles.accion}>{accionAuditoria(e.comando)}</Text>
                <Text style={styles.meta}>
                  {e.usuarioNombre} · {fechaRelativa(e.fecha)}
                </Text>
                {e.motivo ? <Text style={styles.motivo}>“{e.motivo}”</Text> : null}
                {difs.map((d) => (
                  <Text key={d.campo} style={styles.cambio}>
                    {d.campo}: {d.antes} → {d.despues}
                  </Text>
                ))}
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
  item: { paddingVertical: 12, gap: 2 },
  sep: { borderTopWidth: 1, borderTopColor: c.faint },
  accion: { ...tipoDe(c).dato, fontSize: 15 },
  meta: tipoDe(c).nota,
  motivo: { ...tipoDe(c).nota, fontStyle: 'italic', marginTop: 2 },
  cambio: { fontSize: 13, color: c.muted, marginTop: 2 },
});
