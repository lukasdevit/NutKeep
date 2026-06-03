'use client';

import { useState, useEffect } from 'react';

interface TableInfo {
  name: string;
  rowCount: number;
}

interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  refreshKey: number;
  expanded: string | null;
  onExpand: (table: string | null) => void;
}

export function TableBrowser({
  apiFetch,
  refreshKey,
  expanded,
  onExpand,
}: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [deleteRowConfirm, setDeleteRowConfirm] = useState<string | null>(null);

  async function fetchTables() {
    try {
      const r = await apiFetch('/admin/db/tables');
      if (r.ok) setTables(await r.json());
    } catch {
      /* */
    }
  }

  useEffect(() => {
    fetchTables();
  }, [refreshKey]);

  useEffect(() => {
    if (tables.length > 0 && !expanded) {
      const preferred = tables.find((t) => t.name === 'users') ?? tables[0];
      if (preferred) onExpand(preferred.name);
    }
  }, [tables]);

  useEffect(() => {
    if (expanded) loadTableData(expanded);
  }, [expanded]);

  async function loadTableData(tableName: string) {
    setTableLoading(true);
    setTableData(null);
    try {
      const r = await apiFetch(
        `/admin/db/tables/${encodeURIComponent(tableName)}/rows`
      );
      const d = await r.json();
      if (r.ok) setTableData({ columns: d.columns || [], rows: d.rows || [] });
    } catch {
      /* */
    }
    setTableLoading(false);
  }

  function handleTableClick(tableName: string) {
    if (expanded === tableName) {
      onExpand(null);
      setTableData(null);
    } else {
      onExpand(tableName);
      loadTableData(tableName);
    }
  }

  async function deleteTableRow(
    tableName: string,
    pkCol: string,
    pkVal: unknown
  ) {
    try {
      const r = await apiFetch(
        `/admin/db/tables/${encodeURIComponent(tableName)}/rows`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pkColumn: pkCol, pkValue: pkVal }),
        }
      );
      if (r.ok) {
        setDeleteRowConfirm(null);
        loadTableData(tableName);
        fetchTables();
      }
    } catch {
      /* */
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
        Tables
      </p>
      <div className="flex flex-wrap gap-1">
        {tables.map((t) => (
          <button
            type="button"
            key={t.name}
            onClick={() => handleTableClick(t.name)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors border ${
              expanded === t.name
                ? 'bg-violet-600/20 text-violet-300 border-violet-600/40'
                : 'bg-zinc-800/50 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
            }`}
          >
            <span>{t.name}</span>
            <span className="text-zinc-500">{t.rowCount}</span>
          </button>
        ))}
      </div>

      {expanded && tableLoading && (
        <p className="text-xs text-zinc-500 py-2">Loading {expanded}…</p>
      )}

      {expanded && tableData && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-300">
                {expanded}
              </span>
              <span className="text-xs text-zinc-600">
                {tableData.rows.length} row
                {tableData.rows.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => loadTableData(expanded)}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          <div className="table-result max-h-64">
            <table>
              <thead>
                <tr>
                  <th className="w-6" />
                  {tableData.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, i) => {
                  const pkCol = tableData.columns[0];
                  const pkVal = row[pkCol];
                  const rowKey = `${i}-${pkVal}`;
                  const isConfirming = deleteRowConfirm === rowKey;
                  const isAdminRow =
                    expanded === 'users' &&
                    (row['is_admin'] === 1 || row['is_admin'] === '1');
                  return (
                    <tr key={rowKey}>
                      <td className="px-1 py-1 text-center">
                        {isAdminRow ? (
                          <span
                            className="text-[10px] text-amber-500/50 px-1"
                            title="Cannot delete admin user"
                          >
                            🔒
                          </span>
                        ) : isConfirming ? (
                          <span className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                deleteTableRow(expanded, pkCol, pkVal)
                              }
                              className="text-[10px] text-red-400 hover:text-red-300 font-bold px-1"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteRowConfirm(null)}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteRowConfirm(rowKey)}
                            className="text-[10px] text-zinc-600 hover:text-red-400 px-1 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                      {tableData.columns.map((col) => {
                        const raw = row[col];
                        const str = maskCell(col, raw);
                        const truncated =
                          str.length > 150 ? str.slice(0, 150) + '…' : str;
                        return (
                          <td
                            key={col}
                            className={
                              raw === null
                                ? 'text-zinc-600 italic'
                                : col === 'password_hash' && raw !== null
                                  ? 'text-zinc-500'
                                  : 'text-zinc-300'
                            }
                            title={
                              col === 'password_hash' && raw !== null
                                ? 'hidden'
                                : str
                            }
                          >
                            {truncated}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function maskCell(col: string, val: unknown): string {
  if (col === 'password_hash') return '***';
  if (val === null) return 'NULL';
  return String(val);
}
