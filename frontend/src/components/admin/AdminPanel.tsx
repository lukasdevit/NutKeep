'use client';

import { useState, useCallback } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { UserManager } from '@/components/admin/user-manager';
import { TableBrowser } from '@/components/admin/TableBrowser';
import { StorageConfig } from '@/components/admin/storage-config';
import { SslConfig } from '@/components/admin/SslConfig';
import { Analytics } from '@/components/admin/Analytics';
import { BackupPanel } from '@/components/admin/BackupPanel';
import { LogViewer } from '@/components/admin/LogViewer';
import { IntegrityCheck } from '@/components/admin/IntegrityCheck';
import { AdminActions } from '@/components/admin/AdminActions';
import { ADMIN_TAB_LABELS, ADMIN_TAB_DESCRIPTIONS } from '@/config/constants';
import type { AdminTab } from '@/config/constants';

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  tab: AdminTab;
}

export function AdminPanel({ apiFetch, tab }: Props) {
  const [tablesKey, setTablesKey] = useState(0);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const refreshTables = useCallback(() => setTablesKey((k) => k + 1), []);

  return (
    <ToastProvider>
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {ADMIN_TAB_LABELS[tab]}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {ADMIN_TAB_DESCRIPTIONS[tab]}
          </p>
        </div>

        {tab === 'users' && <UserManager apiFetch={apiFetch} />}
        {tab === 'database' && (
          <TableBrowser
            apiFetch={apiFetch}
            refreshKey={tablesKey}
            expanded={expandedTable}
            onExpand={setExpandedTable}
          />
        )}
        {tab === 'storage' && <StorageConfig apiFetch={apiFetch} />}
        {tab === 'ssl' && <SslConfig apiFetch={apiFetch} />}
        {tab === 'analytics' && <Analytics apiFetch={apiFetch} />}
        {tab === 'backups' && <BackupPanel apiFetch={apiFetch} />}
        {tab === 'logs' && <LogViewer apiFetch={apiFetch} />}
        {tab === 'integrity' && <IntegrityCheck apiFetch={apiFetch} />}
        {tab === 'actions' && <AdminActions apiFetch={apiFetch} />}
      </div>
    </ToastProvider>
  );
}
