'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

import type { AdminTab } from '@/config/constants';

export type FilesViewMode = 'all' | 'images' | 'audio' | 'video' | 'file';

export type { AdminTab };

interface DashboardState {
  filesViewMode: FilesViewMode;
  adminTab: AdminTab;
}

const STORAGE_KEY = 'nutkeep_dashboard';

function loadState(): DashboardState {
  if (typeof window === 'undefined')
    return { filesViewMode: 'all', adminTab: 'users' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
      return {
        ...{ filesViewMode: 'all', adminTab: 'users' },
        ...JSON.parse(raw),
      };
  } catch {
    /* ignore */
  }
  return { filesViewMode: 'all', adminTab: 'users' };
}

function saveState(state: DashboardState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

interface ContextValue extends DashboardState {
  setFilesViewMode: (m: FilesViewMode) => void;
  setAdminTab: (t: AdminTab) => void;
}

const DashboardCtx = createContext<ContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const setFilesViewMode = useCallback(
    (m: FilesViewMode) => setState((s) => ({ ...s, filesViewMode: m })),
    []
  );
  const setAdminTab = useCallback(
    (t: AdminTab) => setState((s) => ({ ...s, adminTab: t })),
    []
  );

  const value = useMemo(
    () => ({ ...state, setFilesViewMode, setAdminTab }),
    [state, setFilesViewMode, setAdminTab]
  );

  return (
    <DashboardCtx.Provider value={value}>
      {children}
    </DashboardCtx.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardCtx);
  if (!ctx)
    throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
