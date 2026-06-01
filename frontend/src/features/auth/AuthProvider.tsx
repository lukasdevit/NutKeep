'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { UserInfo } from '@/types';
import { apiFetch } from '@/lib/api-client';

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  endDemoSession: () => Promise<void>;
  logout: () => void;
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('nutkeep_token');
    if (saved) {
      setToken(saved);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Skip re-validation if user already set (just logged in/registered)
    if (user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(token, '/auth/me').then(async (r) => {
      if (cancelled) return;
      if (r.ok) setUser((await r.json()).user);
      else {
        localStorage.removeItem('nutkeep_token');
        setToken(null);
      }
    }).catch(() => {
      localStorage.removeItem('nutkeep_token');
      setToken(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const api = useCallback(
    (path: string, options?: RequestInit) => {
      return apiFetch(token, path, options);
    },
    [token]
  );

  async function login(username: string, password: string) {
    const r = await apiFetch(null, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setToken(d.token);
    setUser(d.user);
    localStorage.setItem('nutkeep_token', d.token);
  }

  async function demoLogin() {
    const r = await apiFetch(null, '/auth/demo', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setToken(d.token);
    setUser(d.user);
    localStorage.setItem('nutkeep_token', d.token);
  }

  async function endDemoSession() {
    if (!token || !user?.isDemo) return;
    try {
      await apiFetch(token, '/auth/demo-session', { method: 'POST' });
    } catch {
      /* best-effort */
    }
  }

  async function register(username: string, password: string) {
    const r = await apiFetch(null, '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setToken(d.token);
    setUser(d.user);
    localStorage.setItem('nutkeep_token', d.token);
  }

  function logout() {
    if (token && user?.isDemo) {
      // fire-and-forget: delete demo user on server
      apiFetch(token, '/auth/demo-session', { method: 'POST', keepalive: true }).catch(() => {});
    }
    setToken(null);
    setUser(null);
      localStorage.removeItem('nutkeep_token');
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      demoLogin,
      endDemoSession,
      logout,
      api,
    }),
    [token, user, loading, api]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
