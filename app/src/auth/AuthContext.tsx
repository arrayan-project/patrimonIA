import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, type LoginResult, type UsuarioDTO } from '../api/client';

interface Session {
  token: string;
  usuario: { id: string; email: string; nombre: string };
}

interface AuthContextValue {
  session: Session | null;
  registrar: (email: string, nombre: string, password: string) => Promise<void>;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Estado de sesión en memoria. La persistencia (expo-secure-store) se agrega
 * más adelante — en el esqueleto de Fase 1 la sesión se pierde al reiniciar.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResult>('/auth/login', { email, password });
    setSession({ token: res.accessToken, usuario: res.usuario });
  }, []);

  const registrar = useCallback(
    async (email: string, nombre: string, password: string) => {
      await api.post<UsuarioDTO>('/comandos/RegistrarUsuario', { email, nombre, password });
      await iniciarSesion(email, password);
    },
    [iniciarSesion],
  );

  const cerrarSesion = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({ session, registrar, iniciarSesion, cerrarSesion }),
    [session, registrar, iniciarSesion, cerrarSesion],
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
