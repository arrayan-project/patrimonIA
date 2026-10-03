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
  ['composicion', 'Composición'],
  ['disponibilidad', 'Libre para gastar'],
  ['flujo', 'Flujo del mes'],
  ['objetivos', 'Metas'],
  ['accesos', 'Accesos rápidos'],
] as const;
export type SeccionDashboard = (typeof SECCIONES_DASHBOARD)[number][0];

export interface PreferenciasVisualizacion {
  formatoFecha: FormatoFecha;
  /** Moneda que el Inicio muestra como principal si tienes varias (sin convertir). null = la primera. */
  monedaPreferida: string | null;
  dashboard: Record<SeccionDashboard, boolean>;
}

export const PREFERENCIAS_DEFAULT: PreferenciasVisualizacion = {
  formatoFecha: 'legible',
  monedaPreferida: null,
  dashboard: { composicion: true, disponibilidad: true, flujo: true, objetivos: true, accesos: true },
};

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
      // ActualizarDatosUsuario reemplaza el objeto completo: se parte del
      // vigente para no pisar otras claves (p. ej. `notificaciones`).
      const me = await api.get<UsuarioDTO>('/usuarios/me', token);
      const base = (me.preferencias as Record<string, unknown> | null) ?? {};
      await api.post('/comandos/ActualizarDatosUsuario', { preferencias: { ...base, visualizacion: p } }, token);
      aplicar(p);
    },
    [token, aplicar],
  );

  const value = useMemo(() => ({ preferencias, guardarPreferencias }), [preferencias, guardarPreferencias]);
  return <PreferenciasCtx.Provider value={value}>{children}</PreferenciasCtx.Provider>;
}

export function usePreferencias(): Ctx {
  return useContext(PreferenciasCtx);
}
