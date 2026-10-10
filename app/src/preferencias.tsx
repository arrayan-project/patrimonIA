import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type UsuarioDTO } from './api/client';
import { useAuth } from './auth/AuthContext';
import { setFormatoFecha, type FormatoFecha } from './ui';

/**
 * Preferencias personales de visualización (GAPS.md G25). Viven en
 * `usuario.preferencias.visualizacion` (JSONB, junto a `notificaciones`); el
 * backend guarda el objeto tal cual y los defaults los pone el cliente. El tema
 * no está acá: es del dispositivo (TemaProvider). Lo que es del hogar
 * (categorías, moneda de consolidación, tipos de elemento) tampoco.
 */
export const SECCIONES_DASHBOARD = [
  ['composicion', 'Tus cuentas'],
  ['disponibilidad', 'Puedes gastar'],
  ['flujo', 'El mes'],
  ['objetivos', 'Tus metas'],
  ['accesos', 'Atajos'],
] as const;
export type SeccionDashboard = (typeof SECCIONES_DASHBOARD)[number][0];

export interface PreferenciasVisualizacion {
  formatoFecha: FormatoFecha;
  /** Moneda que el Inicio muestra como principal si tienes varias (sin convertir). null = la primera. */
  monedaPreferida: string | null;
  dashboard: Record<SeccionDashboard, boolean>;
  /**
   * G35: el emoji que el usuario eligió para cada cuenta o bien y cada meta
   * (por id). Es personal: otro miembro del hogar ve los suyos. Sin elección,
   * se usa el de `emojis.ts`. El de las categorías es del hogar
   * (`categoria_movimiento.icono`).
   */
  emojis: { elementos: Record<string, string>; metas: Record<string, string> };
}

export const PREFERENCIAS_DEFAULT: PreferenciasVisualizacion = {
  formatoFecha: 'legible',
  monedaPreferida: null,
  dashboard: { composicion: true, disponibilidad: true, flujo: true, objetivos: true, accesos: true },
  emojis: { elementos: {}, metas: {} },
};

/** Las preferencias con el emoji de una cuenta (`elementos`) o una meta (`metas`) cambiado. */
export function conEmoji(
  p: PreferenciasVisualizacion,
  tipo: keyof PreferenciasVisualizacion['emojis'],
  id: string,
  emoji: string,
): PreferenciasVisualizacion {
  return { ...p, emojis: { ...p.emojis, [tipo]: { ...p.emojis[tipo], [id]: emoji } } };
}

/** Solo pares id → texto no vacío. */
function mapaDeTextos(x: unknown): Record<string, string> {
  if (!x || typeof x !== 'object') return {};
  return Object.fromEntries(
    Object.entries(x as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]),
  );
}

/** Lee `preferencias.visualizacion` completando con defaults lo que falte o no sea válido. */
function leerVisualizacion(u: UsuarioDTO | null): PreferenciasVisualizacion {
  const v = (u?.preferencias as { visualizacion?: Partial<PreferenciasVisualizacion> } | null)?.visualizacion ?? {};
  const dashboard = { ...PREFERENCIAS_DEFAULT.dashboard };
  for (const [k] of SECCIONES_DASHBOARD) {
    if (typeof v.dashboard?.[k] === 'boolean') dashboard[k] = v.dashboard[k];
  }
  return {
    formatoFecha: v.formatoFecha === 'numerico' ? 'numerico' : 'legible',
    monedaPreferida: typeof v.monedaPreferida === 'string' && v.monedaPreferida ? v.monedaPreferida : null,
    dashboard,
    emojis: { elementos: mapaDeTextos(v.emojis?.elementos), metas: mapaDeTextos(v.emojis?.metas) },
  };
}

interface Ctx {
  preferencias: PreferenciasVisualizacion;
  guardarPreferencias: (p: PreferenciasVisualizacion) => Promise<void>;
}

const PreferenciasCtx = createContext<Ctx>({
  preferencias: PREFERENCIAS_DEFAULT,
  guardarPreferencias: async () => undefined,
});

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const token = session?.token;
  const [preferencias, setPreferencias] = useState(PREFERENCIAS_DEFAULT);

  const aplicar = useCallback((p: PreferenciasVisualizacion) => {
    setFormatoFecha(p.formatoFecha);
    setPreferencias(p);
  }, []);

  useEffect(() => {
    if (!token) {
      aplicar(PREFERENCIAS_DEFAULT);
      return;
    }
    api
      .get<UsuarioDTO>('/usuarios/me', token)
      .then((u) => aplicar(leerVisualizacion(u)))
      .catch(() => undefined);
  }, [token, aplicar]);

  const guardarPreferencias = useCallback(
    async (p: PreferenciasVisualizacion) => {
      if (!token) return;
      // Plantilla Ajustes (R5): se aplica al instante y, si falla, se revierte.
      const anterior = preferencias;
      aplicar(p);
      try {
        // ActualizarDatosUsuario reemplaza el objeto completo: se parte del
        // vigente para no pisar otras claves (p. ej. `notificaciones`).
        const me = await api.get<UsuarioDTO>('/usuarios/me', token);
        const base = (me.preferencias as Record<string, unknown> | null) ?? {};
        await api.post('/comandos/ActualizarDatosUsuario', { preferencias: { ...base, visualizacion: p } }, token);
      } catch (e) {
        aplicar(anterior);
        throw e;
      }
    },
    [token, aplicar, preferencias],
  );

  const value = useMemo(() => ({ preferencias, guardarPreferencias }), [preferencias, guardarPreferencias]);
  return <PreferenciasCtx.Provider value={value}>{children}</PreferenciasCtx.Provider>;
}

export function usePreferencias(): Ctx {
  return useContext(PreferenciasCtx);
}
