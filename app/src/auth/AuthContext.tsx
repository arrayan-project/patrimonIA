import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type LoginResult, type UsuarioDTO } from '../api/client';
import { borrar, guardar, leer } from './secureStorage';

interface Session {
  token: string;
  usuario: { id: string; email: string; nombre: string };
}

interface AuthContextValue {
  session: Session | null;
  /** true mientras se restaura la sesión persistida al arrancar. */
  cargando: boolean;
  /**
   * Pide un token de registro para el email. Devuelve el token si el backend lo
   * entrega directo (dev), o null si lo envió por email y hay que pedir el código.
   */
  solicitarTokenRegistro: (email: string) => Promise<string | null>;
  registrar: (
    email: string,
    nombre: string,
    password: string,
    registroToken?: string,
  ) => Promise<void>;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const CLAVE_SESION = 'patrimonia.session';

/** Sesión persistida en almacenamiento seguro (nativo) / localStorage (web). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const raw = await leer(CLAVE_SESION);
      if (!vivo) return;
      if (raw) {
        try {
          const guardada = JSON.parse(raw) as Session;
          // valida que el token siga sirviendo
          await api.get<UsuarioDTO>('/usuarios/me', guardada.token);
          if (vivo) setSession(guardada);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await borrar(CLAVE_SESION);
        }
      }
      if (vivo) setCargando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const persistir = useCallback(async (s: Session) => {
    setSession(s);
    await guardar(CLAVE_SESION, JSON.stringify(s));
  }, []);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<LoginResult>('/auth/login', { email, password });
      await persistir({ token: res.accessToken, usuario: res.usuario });
    },
    [persistir],
  );

  const solicitarTokenRegistro = useCallback(async (email: string) => {
    const r = await api.post<{ token?: string; enviado?: true }>('/auth/registro-token', { email });
    return r.token ?? null;
  }, []);

  const registrar = useCallback(
    async (email: string, nombre: string, password: string, registroToken?: string) => {
      const cuerpo = { email, nombre, password };
      if (registroToken) {
        await api.postWith<UsuarioDTO>('/comandos/RegistrarUsuario', cuerpo, {
          'X-Registro-Token': registroToken,
        });
      } else {
        await api.post<UsuarioDTO>('/comandos/RegistrarUsuario', cuerpo);
      }
      await iniciarSesion(email, password);
    },
    [iniciarSesion],
  );

  const cerrarSesion = useCallback(() => {
    setSession(null);
    void borrar(CLAVE_SESION);
  }, []);

  const value = useMemo(
    () => ({ session, cargando, solicitarTokenRegistro, registrar, iniciarSesion, cerrarSesion }),
    [session, cargando, solicitarTokenRegistro, registrar, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de <AuthProvider>');
  return ctx;
}

export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession sin sesión activa');
  return session;
}
