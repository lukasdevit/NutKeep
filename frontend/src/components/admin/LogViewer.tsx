'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollText, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { CardSkeleton } from '@/components/ui/CardSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface LogEntry {
  time: string;
  level: number;
  levelName: string;
  msg: string;
  reqId?: string;
  user?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  err?: { message?: string; stack?: string; url?: string };
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

/* ── Pretty Log Line ── */

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-amber-400',
  PATCH: 'text-yellow-400',
  DELETE: 'text-red-400',
  OPTIONS: 'text-purple-400',
  HEAD: 'text-zinc-500',
};

function statusColor(code: number): string {
  if (code < 200) return 'text-zinc-500';
  if (code < 300) return 'text-emerald-400';
  if (code < 400) return 'text-amber-400';
  if (code < 500) return 'text-orange-400';
  return 'text-red-400';
}

function timeColor(ms: number): string {
  if (ms < 50) return 'text-emerald-500';
  if (ms < 200) return 'text-zinc-400';
  if (ms < 500) return 'text-amber-400';
  return 'text-red-400';
}

function LogLine({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  const hasDetail =
    !!entry.err || !!entry.url || entry.responseTime !== undefined;

  return (
    <div className="relative">
      <div
        className={`flex gap-2 hover:bg-zinc-900/50 py-0.5 items-baseline ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && onToggle()}
      >
        {/* Timestamp */}
        <span className="text-zinc-600 shrink-0 w-18 text-right text-[11px]">
          {new Date(entry.time).toLocaleTimeString()}
        </span>

        {/* Level badge */}
        <span
          className={`shrink-0 w-10 text-center rounded px-0.5 text-[10px] font-semibold ${
            entry.levelName === 'error' || entry.levelName === 'fatal'
              ? 'bg-red-500/20 text-red-400'
              : entry.levelName === 'warn'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          {entry.levelName.toUpperCase().slice(0, 4)}
        </span>

        {/* Message */}
        <span className="text-zinc-300 break-all leading-snug flex-1 min-w-0">{entry.msg}</span>

        {/* HTTP method + status + time */}
        {entry.method && (
          <span className="shrink-0 flex items-baseline gap-1.5">
            <span className={`font-semibold text-xs ${METHOD_COLORS[entry.method] || 'text-zinc-500'}`}>
              {entry.method}
            </span>
            {entry.statusCode !== undefined && (
              <span className={`font-semibold text-xs ${statusColor(entry.statusCode)}`}>
                {entry.statusCode}
              </span>
            )}
            {entry.responseTime !== undefined && (
              <span className={`text-xs ${timeColor(entry.responseTime)}`}>
                {entry.responseTime}ms
              </span>
            )}
          </span>
        )}

        {/* User */}
        {entry.user && (
          <span className="text-zinc-600 text-[11px] shrink-0">@{entry.user}</span>
        )}

        {/* Expand indicator */}
        {hasDetail && (
          <ChevronRight className={`w-3 h-3 text-zinc-600 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
      </div>

      {/* Expanded detail popover */}
      {expanded && (
        <div className="ml-28 max-w-lg p-3 rounded-md bg-zinc-800/90 border border-zinc-700 text-xs space-y-1 shadow-lg z-10">
          {entry.url && (
            <div>
              <span className="text-zinc-500">URL: </span>
              <span className="text-zinc-300 break-all">{entry.url}</span>
            </div>
          )}
          {entry.reqId && (
            <div>
              <span className="text-zinc-500">Request ID: </span>
              <span className="text-zinc-400 font-mono">{entry.reqId}</span>
            </div>
          )}
          {entry.responseTime !== undefined && (
            <div>
              <span className="text-zinc-500">Response time: </span>
              <span className={timeColor(entry.responseTime)}>
                {entry.responseTime}ms
              </span>
            </div>
          )}
          {entry.err && (
            <div>
              <span className="text-red-400 font-semibold">Error:</span>
              {entry.err.message && (
                <p className="text-red-300 mt-0.5">{entry.err.message}</p>
              )}
              {entry.err.stack && (
                <pre className="text-zinc-500 mt-1 whitespace-pre-wrap text-[10px] max-h-40 overflow-y-auto">
                  {entry.err.stack}
                </pre>
              )}
              {entry.err.url && (
                <p className="text-zinc-500 mt-1">Page: {entry.err.url}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LogViewer({ apiFetch }: Props) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('30');
  const [lines, setLines] = useState('200');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(() => {
    apiFetch(`/admin/logs?lines=${lines}&level=${level}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiFetch, lines, level]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoRefresh]);

  async function handleClear() {
    try {
      await apiFetch('/admin/logs', { method: 'DELETE' });
      toast('Logs cleared', 'ok');
      fetchLogs();
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  }

  async function handleDownload() {
    try {
      const r = await apiFetch('/admin/logs/download');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nutkeep-app.log';
      a.click();
    } catch {
      toast('Failed to download logs', 'err');
    }
  }

  return (
    <section className="card space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="card-title flex items-center gap-2"><ScrollText className="w-4 h-4" /> Server Logs</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setLoading(true);
            }}
            className="px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none"
          >
            <option value="10">Trace</option>
            <option value="20">Debug</option>
            <option value="30">Info</option>
            <option value="40">Warn</option>
            <option value="50">Error</option>
          </select>
          <select
            value={lines}
            onChange={(e) => {
              setLines(e.target.value);
              setLoading(true);
            }}
            className="px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none"
          >
            <option value="50">50 lines</option>
            <option value="100">100 lines</option>
            <option value="200">200 lines</option>
            <option value="500">500 lines</option>
            <option value="1000">1000 lines</option>
          </select>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="btn-zinc text-xs"
          >
            Download
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="btn-zinc text-xs text-red-400 hover:text-red-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log output */}
      {loading ? (
        <CardSkeleton lines={8} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="w-8 h-8 text-zinc-600" />}
          title="No log entries"
          description="Logs will appear here as the server processes requests."
        />
      ) : (
        <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-auto max-h-[60vh]">
          <div className="p-3 font-mono text-xs leading-relaxed">
            {logs.map((entry, i) => (
              <LogLine key={i} entry={entry} expanded={expandedIdx === i} onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </section>
  );
}
