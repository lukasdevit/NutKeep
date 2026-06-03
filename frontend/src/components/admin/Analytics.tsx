'use client';

import { useState, useEffect } from 'react';
import { Users, FileText, HardDrive, UploadCloud } from 'lucide-react';
import { formatSize } from '@/lib/utils';

interface DailyPoint {
  day: string;
  count: number;
  bytes: number;
}
interface TopUser {
  username: string;
  files: number;
  bytes: number;
}
interface Category {
  category: string;
  count: number;
  bytes: number;
}
interface AnalyticsData {
  users: number;
  total_files: number;
  total_bytes: number;
  uploads_today: number;
  daily: DailyPoint[];
  top_users: TopUser[];
  categories: Category[];
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

export function Analytics({ apiFetch }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/admin/analytics')
      .then((r) => r.json())
      .then((d: AnalyticsData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiFetch]);

  if (loading)
    return (
      <section className="card">
        <p className="text-sm text-zinc-500">Loading…</p>
      </section>
    );
  if (!data)
    return (
      <section className="card">
        <p className="text-sm text-red-400">Failed to load analytics.</p>
      </section>
    );

  const maxDayCount = Math.max(1, ...data.daily.map((d) => d.count));
  const maxTopBytes = Math.max(1, ...data.top_users.map((u) => u.bytes));
  const maxCatBytes = Math.max(1, ...data.categories.map((c) => c.bytes));

  return (
    <div className="space-y-6">
      <OverviewCards data={data} />
      <UploadsChart daily={data.daily} maxCount={maxDayCount} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <TopUsers users={data.top_users} maxBytes={maxTopBytes} />
        <FileTypes categories={data.categories} maxBytes={maxCatBytes} />
      </div>
    </div>
  );
}

function OverviewCards({ data }: { data: AnalyticsData }) {
  const cards = [
    { label: 'Users', value: data.users, Icon: Users },
    { label: 'Total Files', value: data.total_files, Icon: FileText },
    { label: 'Storage Used', value: formatSize(data.total_bytes), Icon: HardDrive },
    { label: 'Uploads Today', value: data.uploads_today, Icon: UploadCloud },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700"
        >
          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <c.Icon className="w-3.5 h-3.5" /> {c.label}
          </span>
          <p className="text-xl font-semibold text-zinc-100 mt-1">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function UploadsChart({
  daily,
  maxCount,
}: {
  daily: DailyPoint[];
  maxCount: number;
}) {
  return (
    <section className="card">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">
        Uploads — Last 30 Days
      </h3>
      {daily.length === 0 ? (
        <p className="text-xs text-zinc-500">No data yet.</p>
      ) : (
        <div className="flex items-end gap-0.5 h-32">
          {daily.map((d) => (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center gap-1 group relative"
              title={`${d.day}: ${d.count} files, ${formatSize(d.bytes)}`}
            >
              <span className="text-[10px] text-zinc-600 group-hover:text-zinc-300 transition-colors">
                {d.count}
              </span>
              <div
                className="w-full bg-violet-500/60 hover:bg-violet-400 rounded-t transition-colors min-h-0.5"
                style={{
                  height: `${Math.max(2, (d.count / maxCount) * 100)}%`,
                }}
              />
              <span className="text-[9px] text-zinc-700">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TopUsers({ users, maxBytes }: { users: TopUser[]; maxBytes: number }) {
  const active = users.filter((u) => u.bytes > 0);
  return (
    <section className="card">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Users</h3>
      {active.length === 0 ? (
        <p className="text-xs text-zinc-500">No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {active.map((u, i) => (
            <div key={u.username} className="flex items-center gap-3">
              <span className="text-xs text-zinc-600 w-4">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-zinc-300 truncate">{u.username}</span>
                  <span className="text-zinc-500 ml-2 whitespace-nowrap">
                    {formatSize(u.bytes)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${(u.bytes / maxBytes) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FileTypes({
  categories,
  maxBytes,
}: {
  categories: Category[];
  maxBytes: number;
}) {
  return (
    <section className="card">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">File Types</h3>
      {categories.length === 0 ? (
        <p className="text-xs text-zinc-500">No data.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.category}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-zinc-300">{c.category}</span>
                <span className="text-zinc-500">
                  {c.count} files · {formatSize(c.bytes)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.bytes / maxBytes) * 100}%`,
                    background:
                      c.category === 'Images'
                        ? '#3b82f6'
                        : c.category === 'Videos'
                          ? '#ef4444'
                          : c.category === 'Text / Code'
                            ? '#22c55e'
                            : '#a855f7',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
