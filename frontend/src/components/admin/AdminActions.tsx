'use client';

import { useState, useEffect, useCallback } from 'react';
import { History } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/RowSkeleton';
import { getApiErrorMessage } from '@/lib/api-error';

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

interface AdminAction {
  id: number;
  timestamp: string;
  username: string;
  action: string;
  description: string;
  undone: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  'delete-db': 'Deleted DB entry',
  'delete-file': 'Deleted file',
  import: 'Imported file',
  migrate: 'Migrated file',
  skip: 'Skipped issue',
  'storage-config': 'Storage config',
  'backup-run': 'Backup run',
  'backup-upload': 'Backup upload',
  'backup-delete': 'Backup delete',
  'backup-restore': 'DB restore',
  'logs-clear': 'Logs cleared',
  'db-delete': 'DB row delete',
  'user-create': 'User created',
  'user-edit': 'User edited',
  'user-delete': 'User deleted',
};

export function AdminActions({ apiFetch }: Props) {
  const { toast } = useToast();
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchActions = useCallback(() => {
    setLoading(true);
    apiFetch('/admin/actions')
      .then((r) => r.json())
      .then((d) => setActions(d.actions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  async function handleUndo(id: number, action: string) {
    const unUndoable = [
      'delete-file',
      'backup-restore',
      'backup-delete',
      'backup-upload',
      'storage-config',
      'logs-clear',
      'user-edit',
      'user-delete',
    ];
    if (unUndoable.includes(action)) {
      toast('This action cannot be undone', 'err');
      return;
    }
    setUndoing(id);
    try {
      const r = await apiFetch(`/admin/actions/${id}/undo`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(getApiErrorMessage(d, r.status));
      toast(`Undone: ${d.undone}`, 'ok');
      fetchActions();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setUndoing(null);
    }
  }

  async function clearUndone() {
    setClearing(true);
    try {
      const r = await apiFetch('/admin/actions', { method: 'DELETE' });
      const d = await r.json();
      toast(`Cleared ${d.deleted} undone action(s)`, 'ok');
      fetchActions();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setClearing(false);
    }
  }

  const undoneCount = actions.filter((a) => a.undone).length;

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-title">🕓 Admin Actions</h2>
        {undoneCount > 0 && (
          <button
            type="button"
            onClick={clearUndone}
            disabled={clearing}
            className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            {clearing ? 'Clearing…' : `Clear ${undoneCount} undone`}
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        Log of all admin operations. Click{' '}
        <span className="text-amber-400">Undo</span> to reverse an action where
        possible.
      </p>

      {loading ? (
        <RowSkeleton cols={5} rows={5} />
      ) : actions.length === 0 ? (
        <EmptyState
          icon={<History className="w-8 h-8 text-zinc-600" />}
          title="No actions recorded"
          description="Admin actions will appear here as you use the admin panel."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-400">
            <thead>
              <tr className="text-left border-b border-zinc-800">
                <th className="py-1.5 pr-3 font-medium">Time</th>
                <th className="py-1.5 pr-3 font-medium">Admin</th>
                <th className="py-1.5 pr-3 font-medium">Action</th>
                <th className="py-1.5 pr-3 font-medium">Description</th>
                <th className="py-1.5 font-medium w-20">Undo</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr
                  key={a.id}
                  className={`border-b border-zinc-800/50 ${a.undone ? 'opacity-40' : ''}`}
                >
                  <td className="py-1.5 pr-3 text-zinc-500">
                    {new Date(a.timestamp).toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-3 text-zinc-300">@{a.username}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={
                        a.action.includes('delete') || a.action === 'db-delete'
                          ? 'text-red-400'
                          : a.action.includes('import') ||
                              a.action.includes('create') ||
                              a.action === 'backup-upload'
                            ? 'text-green-400'
                            : a.action.includes('migrate') ||
                                a.action.includes('edit')
                              ? 'text-blue-400'
                              : a.action.includes('restore') ||
                                  a.action.includes('backup-run')
                                ? 'text-amber-400'
                                : 'text-zinc-400'
                      }
                    >
                      {ACTION_LABELS[a.action] || a.action}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-zinc-500 max-w-75 truncate">
                    {a.description}
                  </td>
                  <td className="py-1.5">
                    {a.undone ? (
                      <span className="text-zinc-600 text-[10px]">Undone</span>
                    ) : [
                        'delete-file',
                        'backup-restore',
                        'backup-delete',
                        'backup-upload',
                        'storage-config',
                        'logs-clear',
                        'user-edit',
                        'user-delete',
                      ].includes(a.action) ? (
                      <span
                        className="text-zinc-600 text-[10px]"
                        title="Not undoable"
                      >
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={undoing === a.id}
                        onClick={() => handleUndo(a.id, a.action)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                      >
                        {undoing === a.id ? '…' : 'Undo'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
