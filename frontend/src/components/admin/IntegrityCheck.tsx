'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';
import { DeleteButton } from '@/components/ui/DeleteButton';
import { CardSkeleton } from '@/components/ui/CardSkeleton';

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

interface SavedCheck {
  id: number;
  check_id: string;
  created_at: string;
  total_issues: number;
  missing_files: number;
  orphaned_files: number;
  size_mismatches: number;
}

interface CheckSummary {
  checkId: string;
  total: number;
  summary: {
    missingFiles: number;
    orphanedFiles: number;
    sizeMismatches: number;
  };
}

interface IntegrityIssue {
  id: number;
  type: 'missing-file' | 'orphaned-file' | 'size-mismatch';
  fileId?: number;
  filename?: string;
  originalName?: string;
  userId?: number;
  diskPath?: string;
  dbSize?: number;
  diskSize?: number;
  resolved: boolean;
}

interface CheckPage {
  issues: IntegrityIssue[];
  offset: number;
  limit: number;
  total: number;
  unresolved: number;
}

const TYPE_ICONS: Record<string, string> = {
  'missing-file': '❌',
  'orphaned-file': '👻',
  'size-mismatch': '⚠️',
};
const TYPE_DESC: Record<string, string> = {
  'missing-file': 'DB entry exists but file missing from disk',
  'orphaned-file': 'File on disk has no DB entry',
  'size-mismatch': 'DB size ≠ disk size',
};

export function IntegrityCheck({ apiFetch }: Props) {
  const { toast } = useToast();
  const [savedChecks, setSavedChecks] = useState<SavedCheck[]>([]);
  const [activeCheckId, setActiveCheckId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [unresolved, setUnresolved] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [scanUserId, setScanUserId] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [deletingCheck, setDeletingCheck] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const loadChecks = useCallback(() => {
    apiFetch('/admin/storage/integrity')
      .then((r) => r.json())
      .then((d) => setSavedChecks(d.checks ?? []))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    loadChecks();
  }, [loadChecks]);

  const loadPage = useCallback(
    async (checkId: string, pageNum: number) => {
      setLoading(true);
      setSelected(new Set());
      const params = new URLSearchParams({
        offset: String(pageNum * pageSize),
        limit: String(pageSize),
      });
      if (filterType) params.set('type', filterType);
      try {
        const r = await apiFetch(
          `/admin/storage/integrity/${checkId}?${params}`
        );
        const d: CheckPage = await r.json();
        setIssues(d.issues);
        setTotal(d.total);
        setUnresolved(d.unresolved);
      } catch {
        toast('Failed to load results', 'err');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, toast, filterType, pageSize]
  );

  useEffect(() => {
    if (activeCheckId) {
      loadPage(activeCheckId, 0);
      setPage(0);
    }
  }, [filterType, pageSize, activeCheckId]);

  async function startCheck() {
    setRunning(true);
    try {
      const body: Record<string, unknown> = {};
      if (scanUserId) {
        const num = parseInt(scanUserId, 10);
        if (!isNaN(num) && num > 0) body.userId = num;
        else body.username = scanUserId;
      }

      const r = await apiFetch('/admin/storage/integrity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setSummary(d);
      setActiveCheckId(d.checkId);
      setFilterType('');
      await loadPage(d.checkId, 0);
      setPage(0);
      loadChecks();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setRunning(false);
    }
  }

  function openSavedCheck(checkId: string) {
    const found = savedChecks.find((c) => c.check_id === checkId);
    if (found) {
      setActiveCheckId(checkId);
      setSummary({
        checkId,
        total: found.total_issues,
        summary: {
          missingFiles: found.missing_files,
          orphanedFiles: found.orphaned_files,
          sizeMismatches: found.size_mismatches,
        },
      });
      setFilterType('');
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    const unresolvedIds = issues.filter((i) => !i.resolved).map((i) => i.id);
    // Toggle: if all unresolved on page are already selected, deselect all
    const allSelected = unresolvedIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unresolvedIds));
    }
  }

  function handleBulkClick(action: string) {
    if (confirmAction === action) {
      setConfirmAction(null);
      if (action === 'migrate') migrateFiles();
      else bulkAction(action);
    } else {
      setConfirmAction(action);
    }
  }

  async function bulkAction(action: string) {
    if (selected.size === 0) return;
    setBulkRunning(true);
    const ids = Array.from(selected);
    const endpoint =
      action === 'import'
        ? `/admin/storage/integrity/${activeCheckId}/import`
        : `/admin/storage/integrity/${activeCheckId}/resolve-bulk`;
    const body: Record<string, unknown> = { issueIds: ids };
    if (action !== 'import') body.action = action;
    try {
      const r = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast(
        `${action === 'import' ? `Imported ${d.imported.length} files` : `Resolved ${d.resolved} issues`}`,
        'ok'
      );
      setSelected(new Set());
      loadPage(activeCheckId!, page);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBulkRunning(false);
    }
  }

  async function migrateFiles() {
    const toUserIdStr = prompt('Enter target user ID:');
    const toUserId = parseInt(toUserIdStr || '', 10);
    if (!toUserId || toUserId < 1) {
      toast('Invalid user ID', 'err');
      return;
    }
    if (selected.size === 0) return;
    setBulkRunning(true);
    const paths = Array.from(selected)
      .map((id) => issues.find((i) => i.id === id)?.diskPath)
      .filter(Boolean) as string[];
    try {
      const r = await apiFetch('/admin/storage/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, toUserId }),
      });
      const d = await r.json();
      if (d.migrated.length)
        toast(`Migrated ${d.migrated.length} files to user #${toUserId}`, 'ok');
      if (d.errors.length)
        toast(`${d.errors.length} errors: ${d.errors[0]}`, 'err');
      setSelected(new Set());
      loadPage(activeCheckId!, page);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBulkRunning(false);
    }
  }

  async function resolveSingle(issueId: number, action: string) {
    try {
      const r = await apiFetch(
        `/admin/storage/integrity/${activeCheckId}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId, action }),
        }
      );
      if (!r.ok) throw new Error((await r.json()).error);
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, resolved: true } : i))
      );
      setUnresolved((u) => u - 1);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  }

  async function importSingle(issueId: number, customName?: string) {
    try {
      const body: Record<string, unknown> = { issueIds: [issueId] };
      if (customName) body.originalName = customName;

      const r = await apiFetch(
        `/admin/storage/integrity/${activeCheckId}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, resolved: true } : i))
      );
      setUnresolved((u) => u - 1);
      toast('File imported to database', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  }

  function handleDeleteCheckClick(checkId: string) {
    if (deletingCheck.has(checkId)) {
      deleteCheck(checkId);
    } else {
      setDeletingCheck((prev) => new Set(prev).add(checkId));
    }
  }

  async function deleteCheck(checkId: string) {
    await apiFetch(`/admin/storage/integrity/${checkId}`, { method: 'DELETE' });
    if (activeCheckId === checkId) {
      setActiveCheckId(null);
      setSummary(null);
      setIssues([]);
    }
    loadChecks();
    setDeletingCheck((prev) => {
      const next = new Set(prev);
      next.delete(checkId);
      return next;
    });
    toast('Check deleted', 'ok');
  }

  const totalPages = Math.ceil(total / pageSize);
  const selectedOrphans = Array.from(selected).filter((id) =>
    issues.find((i) => i.id === id && i.type === 'orphaned-file' && !i.resolved)
  );

  return (
    <section className="card space-y-5">
      <h2 className="card-title">🔍 Storage Integrity Check</h2>
      <p className="text-xs text-zinc-500">
        Compares database entries against files on disk. Checks persist across
        restarts.
      </p>

      {/* Saved checks */}
      {savedChecks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-2">
            Saved Checks
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedChecks.map((c) => (
              <div
                key={c.check_id}
                role="button"
                tabIndex={0}
                onClick={() => openSavedCheck(c.check_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openSavedCheck(c.check_id);
                }}
                className={`px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                  activeCheckId === c.check_id
                    ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
                <span className="text-zinc-600">{c.total_issues} issues</span>
                <span onClick={(e) => e.stopPropagation()}>
                  <DeleteButton
                    id={0}
                    confirming={deletingCheck.has(c.check_id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCheckClick(c.check_id);
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run button + User ID scope */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter: username/id"
          value={scanUserId}
          onChange={(e) => setScanUserId(e.target.value)}
          className="px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs w-44 focus:outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={startCheck}
          disabled={running}
          className="btn-blue text-xs"
        >
          {running ? 'Scanning…' : 'Run New Integrity Check'}
        </button>
        {scanUserId && (
          <span className="text-xs text-zinc-500">
            Scanning only user #{scanUserId}
          </span>
        )}
      </div>

      {summary && (
        <MetricGrid>
          <MetricCard label="Total Issues" value={total} />
          <MetricCard
            label="Missing Files"
            value={summary.summary.missingFiles}
          />
          <MetricCard
            label="Orphaned Files"
            value={summary.summary.orphanedFiles}
          />
          <MetricCard
            label="Size Mismatches"
            value={summary.summary.sizeMismatches}
          />
        </MetricGrid>
      )}

      {summary && unresolved > 0 && (
        <p className="text-xs text-amber-400">
          {unresolved} issue(s) remaining
        </p>
      )}
      {summary && unresolved === 0 && total > 0 && (
        <p className="text-xs text-green-400">All issues resolved ✓</p>
      )}
      {summary && total === 0 && (
        <p className="text-xs text-green-400">Storage is clean ✓</p>
      )}

      {/* Filters — always visible when check is active */}
      {activeCheckId && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none"
          >
            <option value="">All types</option>
            <option value="missing-file">Missing files</option>
            <option value="orphaned-file">Orphaned files</option>
            <option value="size-mismatch">Size mismatches</option>
          </select>
          {filterType && (
            <button
              type="button"
              onClick={() => setFilterType('')}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar — always visible when check is active */}
      {activeCheckId && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border flex-wrap transition-colors ${
            selected.size > 0
              ? 'bg-zinc-800/50 border-zinc-700'
              : 'bg-zinc-900/30 border-zinc-800/50 opacity-50 pointer-events-none'
          }`}
        >
          <span className="text-xs text-zinc-400">
            {selected.size > 0
              ? `${selected.size} selected`
              : 'Select issues below'}
          </span>
          <BulkBtn
            label="Delete DB entries"
            action="delete-db"
            confirm={confirmAction}
            onConfirm={handleBulkClick}
            disabled={bulkRunning || selected.size === 0}
          />
          <BulkBtn
            label="Delete files"
            action="delete-file"
            confirm={confirmAction}
            onConfirm={handleBulkClick}
            disabled={bulkRunning || selected.size === 0}
          />
          <BulkBtn
            label="Import to DB"
            action="import"
            confirm={confirmAction}
            onConfirm={handleBulkClick}
            disabled={bulkRunning || selectedOrphans.length === 0}
            color="green"
          />
          <BulkBtn
            label="Migrate to user"
            action="migrate"
            confirm={confirmAction}
            onConfirm={handleBulkClick}
            disabled={bulkRunning || selectedOrphans.length === 0}
            color="green"
          />
          <BulkBtn
            label="Skip all"
            action="skip"
            confirm={confirmAction}
            onConfirm={handleBulkClick}
            disabled={bulkRunning || selected.size === 0}
            muted
          />
          {confirmAction && (
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 ml-auto"
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectAllOnPage}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {issues
                  .filter((i) => !i.resolved)
                  .every((i) => selected.has(i.id))
                  ? '☑ Deselect all'
                  : '☐ Select all on page'}
              </button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => {
                  setPage(page - 1);
                  loadPage(activeCheckId!, page - 1);
                }}
                className="btn-zinc text-xs"
              >
                ← Prev
              </button>
              <span className="text-xs text-zinc-500">
                Page {page + 1} of {Math.ceil(total / pageSize) || 1}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / pageSize) - 1 || loading}
                onClick={() => {
                  setPage(page + 1);
                  loadPage(activeCheckId!, page + 1);
                }}
                className="btn-zinc text-xs"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <CardSkeleton lines={6} />
            ) : (
              issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  checked={selected.has(issue.id)}
                  onToggle={() => toggleSelect(issue.id)}
                  onResolve={(a) => resolveSingle(issue.id, a)}
                  onImport={() => importSingle(issue.id)}
                  onImportNamed={(name: string) => importSingle(issue.id, name)}
                  onPreview={(path) => setPreviewPath(path)}
                />
              ))
            )}
          </div>
        </>
      )}
      {/* Preview modal */}
      {previewPath && (
        <OrphanPreview
          path={previewPath}
          apiFetch={apiFetch}
          onClose={() => setPreviewPath(null)}
        />
      )}
    </section>
  );
}

/* ── Small Components ── */

function BulkBtn({
  label,
  action,
  confirm,
  onConfirm,
  disabled,
  color,
  muted,
}: {
  label: string;
  action: string;
  confirm: string | null;
  onConfirm: (a: string) => void;
  disabled?: boolean;
  color?: string;
  muted?: boolean;
}) {
  const isConfirming = confirm === action;
  const display = isConfirming ? 'Confirm?' : label;
  const cls = muted
    ? 'bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600'
    : color === 'green'
      ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
      : isConfirming
        ? 'bg-red-600 border-red-500 text-white hover:bg-red-500'
        : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onConfirm(action)}
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${cls} disabled:opacity-40`}
    >
      {display}
    </button>
  );
}

function IssueRow({
  issue,
  checked,
  onToggle,
  onResolve,
  onImport,
  onImportNamed,
  onPreview,
}: {
  issue: IntegrityIssue;
  checked: boolean;
  onToggle: () => void;
  onResolve: (a: string) => void;
  onImport: () => void;
  onImportNamed: (name: string) => void;
  onPreview: (path: string) => void;
}) {
  return (
    <div
      className={`p-3 rounded-lg border text-xs transition-colors ${issue.resolved ? 'bg-zinc-900/30 border-zinc-800/50 opacity-50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer'}`}
    >
      <div
        className="flex items-start gap-3"
        onClick={issue.resolved ? undefined : onToggle}
      >
        {!issue.resolved && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 w-4 h-4 rounded accent-blue-500 cursor-pointer"
          />
        )}
        <div className="min-w-0 space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span>{TYPE_ICONS[issue.type]}</span>
            <span className="font-medium text-zinc-300 capitalize">
              {issue.type.replace('-', ' ')}
            </span>
            {issue.resolved && (
              <span className="text-green-400 text-[10px]">✓ Resolved</span>
            )}
            {issue.userId && (
              <span className="text-zinc-600">User #{issue.userId}</span>
            )}
          </div>
          <p className="text-zinc-500">{TYPE_DESC[issue.type]}</p>
          {issue.originalName && (
            <p className="text-zinc-400 truncate">
              {issue.originalName} ({issue.filename})
            </p>
          )}
          {issue.diskPath && (
            <p className="text-zinc-500 font-mono truncate text-[11px]">
              {issue.diskPath}
            </p>
          )}
          {issue.type === 'size-mismatch' && (
            <p className="text-zinc-400">
              DB: {formatBytes(issue.dbSize ?? 0)} → Disk:{' '}
              {formatBytes(issue.diskSize ?? 0)}
            </p>
          )}
        </div>
        {!issue.resolved && (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {issue.type === 'missing-file' && (
              <MiniBtn
                label="Remove DB"
                onClick={() => onResolve('delete-db')}
              />
            )}
            {issue.type === 'orphaned-file' && (
              <>
                <MiniBtn
                  label="Delete file"
                  onClick={() => onResolve('delete-file')}
                  color="red"
                />
                <MiniBtn label="Import" onClick={onImport} color="green" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = prompt(
                      'Set original filename:',
                      issue.diskPath?.split('/').pop() || ''
                    );
                    if (name?.trim()) onImportNamed(name.trim());
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Edit name
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(issue.diskPath!);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Preview
                </button>
              </>
            )}
            {issue.type === 'size-mismatch' && (
              <MiniBtn label="Skip" onClick={() => onResolve('skip')} />
            )}
            <MiniBtn label="Skip" onClick={() => onResolve('skip')} muted />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBtn({
  label,
  onClick,
  color,
  muted,
}: {
  label: string;
  onClick: () => void;
  color?: string;
  muted?: boolean;
}) {
  const cls = muted
    ? 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
    : color === 'green'
      ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
      : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${cls}`}
    >
      {label}
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function OrphanPreview({
  path: diskPath,
  apiFetch,
  onClose,
}: {
  path: string;
  apiFetch: Props['apiFetch'];
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(diskPath);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/admin/file-preview?path=${encodeURIComponent(diskPath)}`)
      .then(async (r) => {
        if (cancelled) return;
        const blob = await r.blob();
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(blob));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [diskPath]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <div className="absolute top-4 left-4 z-10 text-xs text-zinc-500 font-mono truncate max-w-[60vw]">
        {diskPath.split('/').pop()}
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
      >
        {loading ? (
          <div className="w-8 h-8 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        ) : blobUrl && isImage ? (
          <Image
            src={blobUrl}
            alt={diskPath.split('/').pop() || 'preview'}
            width={1200}
            height={900}
            className="object-contain rounded-lg max-h-[85vh] w-auto h-auto"
            unoptimized
          />
        ) : (
          <iframe
            srcDoc={`<p style="color:#999;font-family:monospace;padding:2rem">Preview not available for this file type.</p>`}
            className="w-80 h-40 border-0"
            title="No preview"
          />
        )}
      </div>
    </div>
  );
}
