'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Archive, FolderOpen } from 'lucide-react';
import { formatSize } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { CardSkeleton } from '@/components/ui/CardSkeleton';
import { RowSkeleton } from '@/components/ui/RowSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';

interface BackupLog {
  id: number;
  timestamp: string;
  destination: string;
  status: string;
  size_bytes: number | null;
  error: string | null;
}

interface BackupFile {
  filename: string;
  size: number;
  created: string;
  modified: string;
}

type PanelTab = 'overview' | 'manage';

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

export function BackupPanel({ apiFetch }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<PanelTab>('overview');

  return (
    <section className="card space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1 w-fit">
        {(['overview', 'manage'] as PanelTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'overview' ? 'Overview' : 'Manage Backups'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <BackupOverview apiFetch={apiFetch} toast={toast} />
      ) : (
        <BackupManage apiFetch={apiFetch} toast={toast} />
      )}
    </section>
  );
}

/* ── Overview Tab ── */

function BackupOverview({
  apiFetch,
  toast,
}: {
  apiFetch: Props['apiFetch'];
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    results: { label: string; ok: boolean; error?: string }[];
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [scheduleHours, setScheduleHours] = useState('6');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [retentionDays, setRetentionDays] = useState('3');

  const fetchHistory = useCallback(() => {
    setLoading(true);
    apiFetch('/admin/backup/history')
      .then((r) => r.json())
      .then((d) => setLogs(d.backups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    fetchHistory();
    apiFetch('/admin/backup/schedule')
      .then((r) => r.json())
      .then((d) => setScheduleHours(String(d.backup_schedule_hours ?? 6)))
      .catch(() => {});
    apiFetch('/admin/storage')
      .then((r) => r.json())
      .then((d) => setRetentionDays(String(d.backup_retention_days ?? 3)))
      .catch(() => {});
  }, [fetchHistory]);

  async function runBackupNow() {
    setRunning(true);
    setResult(null);
    try {
      const r = await apiFetch('/admin/backup/run', { method: 'POST' });
      const d = await r.json();
      setResult(d);
      fetchHistory();
    } catch (err) {
      setResult({
        ok: false,
        results: [{ label: 'error', ok: false, error: (err as Error).message }],
      });
    } finally {
      setRunning(false);
    }
  }

  async function downloadLatest() {
    setDownloading(true);
    try {
      const r = await apiFetch('/admin/backup/latest');
      if (!r.ok) throw new Error('No backup available');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'linqoy-backup.db';
      a.click();
    } catch {
      /* */
    }
    setDownloading(false);
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    try {
      const r = await apiFetch('/admin/backup/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_schedule_hours: parseInt(scheduleHours, 10) }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast('Backup schedule updated', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function saveRetention() {
    try {
      const r = await apiFetch('/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup_retention_days: String(retentionDays) }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast('Retention policy updated', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  }

  const lastOk = logs.find((l) => l.status === 'ok');
  const lastFail = logs.find((l) => l.status === 'fail');
  const successCount = logs.filter((l) => l.status === 'ok').length;
  const successRate =
    logs.length > 0 ? Math.round((successCount / logs.length) * 100) : 0;

  return (
    <>
      <MetricGrid>
        <MetricCard
          label="Total Backups"
          value={logs.length}
          sub={logs.length > 0 ? `${successRate}% success rate` : undefined}
        />
        <MetricCard
          label="Last Backup"
          value={lastOk ? new Date(lastOk.timestamp).toLocaleDateString() : '—'}
          sub={
            lastOk ? new Date(lastOk.timestamp).toLocaleTimeString() : undefined
          }
        />
      </MetricGrid>

      <h2 className="card-title">🗄️ Database Backups</h2>

      <div className="flex gap-3">
        <button
          onClick={runBackupNow}
          disabled={running}
          className="btn-violet text-xs"
        >
          {running ? 'Running…' : 'Backup Now'}
        </button>
        <button
          type="button"
          onClick={downloadLatest}
          disabled={downloading}
          className="btn-zinc text-xs"
        >
          {downloading ? 'Downloading…' : '⬇ Download Latest'}
        </button>
      </div>

      {result && (
        <div
          className={`p-3 rounded-lg text-xs ${result.ok ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}
        >
          {result.results.map((r) => (
            <p key={r.label}>
              {r.label}: {r.ok ? '✅ OK' : `❌ ${r.error}`}
            </p>
          ))}
        </div>
      )}

      {/* Backup config: schedule + retention side by side */}
      <div className="flex items-center gap-6 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
        <div className="flex items-center gap-2">
          <label htmlFor="backup-schedule" className="text-xs text-zinc-400 whitespace-nowrap">
            ⏱ Every
          </label>
          <input
            id="backup-schedule"
            type="number"
            min="1"
            max="168"
            value={scheduleHours}
            onChange={(e) => setScheduleHours(e.target.value)}
            className="w-16 px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
          />
          <span className="text-xs text-zinc-500">hours</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="backup-retention" className="text-xs text-zinc-400 whitespace-nowrap">
            🗑 Keep
          </label>
          <input
            id="backup-retention"
            type="number"
            min="1"
            max="365"
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="w-16 px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
          />
          <span className="text-xs text-zinc-500">days</span>
        </div>
        <button
          type="button"
          onClick={() => { saveSchedule(); saveRetention(); }}
          disabled={scheduleSaving}
          className="btn-green text-xs"
        >
          {scheduleSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex gap-4 text-xs text-zinc-500">
        {lastOk && (
          <span>
            Last OK: {new Date(lastOk.timestamp).toLocaleString()} (
            {lastOk.destination})
          </span>
        )}
        {lastFail && (
          <span className="text-red-400">
            Last fail: {new Date(lastFail.timestamp).toLocaleString()} (
            {lastFail.destination})
          </span>
        )}
        {!lastOk && !lastFail && <span>No backups yet</span>}
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-2">History</h3>
        {loading ? (
          <RowSkeleton cols={5} rows={3} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<Archive className="w-8 h-8 text-zinc-600" />}
            title="No backup history"
            description="Run a backup now to start tracking."
            action={
              <button
                type="button"
                onClick={runBackupNow}
                disabled={running}
                className="btn-violet text-xs"
              >
                Run First Backup
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-zinc-400">
              <thead>
                <tr className="text-left border-b border-zinc-800">
                  <th className="py-1.5 pr-3 font-medium">Time</th>
                  <th className="py-1.5 pr-3 font-medium">Dest</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Size</th>
                  <th className="py-1.5 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-zinc-800/50">
                    <td className="py-1.5 pr-3 text-zinc-500">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-3">{l.destination}</td>
                    <td
                      className={`py-1.5 pr-3 ${l.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {l.status}
                    </td>
                    <td className="py-1.5 pr-3">
                      {l.size_bytes ? formatSize(l.size_bytes) : '-'}
                    </td>
                    <td className="py-1.5 max-w-50 truncate text-red-400">
                      {l.error ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Manage Tab ── */

function BackupManage({
  apiFetch,
  toast,
}: {
  apiFetch: Props['apiFetch'];
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBackups = useCallback(() => {
    setLoading(true);
    apiFetch('/admin/backup/list')
      .then((r) => r.json())
      .then((d) => setBackups(d.backups ?? []))
      .catch(() => toast('Failed to load backups', 'err'))
      .finally(() => setLoading(false));
  }, [apiFetch, toast]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await apiFetch('/admin/backup/upload', {
        method: 'POST',
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast(`Uploaded: ${d.backup.filename}`, 'ok');
      fetchBackups();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete backup "${filename}"?`)) return;
    try {
      const r = await apiFetch('/admin/backup/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast('Backup deleted', 'ok');
      fetchBackups();
    } catch (err) {
      toast((err as Error).message, 'err');
    }
  }

  function startRestore(filename: string) {
    setRestoreTarget(filename);
    setRestoreConfirm('');
    setRestoreResult(null);
  }

  async function confirmRestore() {
    if (!restoreTarget || restoreConfirm !== 'RESTORE') return;
    setRestoring(restoreTarget);
    setRestoreResult(null);
    try {
      const r = await apiFetch('/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: restoreTarget,
          confirm: restoreConfirm,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRestoreResult(d.message);
      toast('Database restored!', 'ok');
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setRestoring(null);
      setRestoreTarget(null);
      setRestoreConfirm('');
    }
  }

  return (
    <>
<h2 className="card-title flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Manage Backups</h2>

      {/* Upload */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".db"
          onChange={handleUpload}
          className="text-xs text-zinc-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:text-xs file:font-medium file:bg-zinc-800 file:text-zinc-200 file:border file:border-zinc-700 hover:file:bg-zinc-700 file:transition-colors"
        />
        {uploading && <span className="text-xs text-zinc-500">Uploading…</span>}
      </div>

      {/* Backup list */}
      {loading ? (
        <RowSkeleton cols={4} rows={3} />
      ) : backups.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-8 h-8 text-zinc-600" />}
          title="No saved backups"
          description="Upload a .db file or trigger a backup from the Overview tab."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-400">
            <thead>
              <tr className="text-left border-b border-zinc-800">
                <th className="py-1.5 pr-3 font-medium">Filename</th>
                <th className="py-1.5 pr-3 font-medium">Size</th>
                <th className="py-1.5 pr-3 font-medium">Date</th>
                <th className="py-1.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filename} className="border-b border-zinc-800/50">
                  <td className="py-1.5 pr-3 font-mono text-zinc-300 truncate max-w-62.5">
                    {b.filename}
                  </td>
                  <td className="py-1.5 pr-3">{formatSize(b.size)}</td>
                  <td className="py-1.5 pr-3 text-zinc-500">
                    {new Date(b.modified).toLocaleString()}
                  </td>
                  <td className="py-1.5">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => startRestore(b.filename)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.filename)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore confirmation modal */}
      {restoreTarget && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
          <p className="text-sm font-medium text-amber-300">
            ⚠️ Restore Database
          </p>
          <p className="text-xs text-amber-200/80">
            This will replace the <strong>entire current database</strong> with
            the backup:{' '}
            <code className="bg-zinc-800 px-1 rounded">{restoreTarget}</code>. A
            safety backup will be created automatically.
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={restoreConfirm === 'RESTORE'}
                onChange={(e) =>
                  setRestoreConfirm(e.target.checked ? 'RESTORE' : '')
                }
                className="rounded"
              />
              I understand, type RESTORE to confirm
            </label>
            <input
              type="text"
              value={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.value)}
              placeholder="RESTORE"
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono w-28 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmRestore}
              disabled={restoreConfirm !== 'RESTORE' || restoring !== null}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-colors"
            >
              {restoring ? 'Restoring…' : '⚠️ Restore Now'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRestoreTarget(null);
                setRestoreConfirm('');
              }}
              className="btn-zinc text-xs"
            >
              Cancel
            </button>
          </div>
          {restoreResult && (
            <p className="text-xs text-green-400">{restoreResult}</p>
          )}
        </div>
      )}
    </>
  );
}
