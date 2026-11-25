import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '../types/domain';
import { can, type Permission } from '../domain/permissions';
import { getProvider, onUnauthorized } from '../services';

interface SessionCtx {
  session: Session | null;
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  can(permission: Permission): boolean;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onUnauthorized(() => setSession(null));
    getProvider()
      .auth.restore()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setReady(true));
  }, []);

  // Cierre automático al expirar la sesión.
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    const t = setTimeout(() => setSession(null), Math.max(0, Math.min(ms, 2 ** 31 - 1)));
    return () => clearTimeout(t);
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    setSession(await getProvider().auth.login(email, password));
  }, []);

  const logout = useCallback(async () => {
    await getProvider().auth.logout();
    setSession(null);
  }, []);

  const value = useMemo<SessionCtx>(
    () => ({ session, ready, login, logout, can: (p) => can(session?.user.role, p) }),
    [session, ready, login, logout]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}
