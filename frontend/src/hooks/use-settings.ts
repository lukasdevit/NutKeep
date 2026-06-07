'use client';

import { useState, useCallback } from 'react';
import type { StorageInfo } from '@/types';
import { getApiErrorMessage } from '@/lib/api-error';

export function useSettings(apiFetch: (path: string, options?: RequestInit) => Promise<Response>) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  const fetchStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      const r = await apiFetch('/auth/storage');
      if (r.ok) setStorage(await r.json());
    } finally {
      setStorageLoading(false);
    }
  }, [apiFetch]);

  const changePassword = useCallback(async (): Promise<string> => {
    const r = await apiFetch('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
    setCurrentPassword('');
    setNewPassword('');
    return 'Password changed successfully';
  }, [apiFetch, currentPassword, newPassword]);

  return {
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    storage, storageLoading,
    fetchStorage,
    changePassword,
  };
}
