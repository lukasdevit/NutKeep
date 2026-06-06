'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { VisibilityToggle } from '@/components/ui/VisibilityToggle';
import { CardSkeleton } from '@/components/ui/CardSkeleton';
import { CollapsibleSection } from './collapsible-section';
import { CorsConfig } from './cors-config';

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

interface StorageData {
  backend: string;
  default_storage_limit: number;
  total_storage_limit: number;
  available_backends: Record<string, string>;
  setting_keys: string[];
  cors_supported: boolean;
  disk_total?: number;
  disk_used?: number;
  disk_free?: number;
  users: number;
  total_files: number;
  total_bytes: number;
  registrations_open: boolean;
  s3_upload_enabled: boolean;
  [key: string]: unknown;
}

function fieldLabel(key: string): string {
  const parts = key.split('_');
  return parts.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function isSecretKey(key: string): boolean {
  return /_(key_id|app_key|access_key|secret_key)$/.test(key);
}

function fmtBytes(b: string): string {
  const n = parseInt(b, 10);
  if (!n) return b;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

function formatSavedMessage(updated: string[], form: Record<string, string>): string {
  const items = updated.map((key) => {
    const label = fieldLabel(key);
    if (isSecretKey(key)) return `${label}: ••••••••`;
    let value = form[key] || '';
    if (key === 'total_storage_limit' && value) value = fmtBytes(value);
    if (key === 'backend' && value) value = form.backend;
    if (key === 'registrations_open' || key === 's3_upload_enabled') {
      value = value === 'true' ? 'on' : 'off';
    }
    return value ? `${label} → ${value}` : label;
  });
  return `Storage updated:\n${items.join('\n')}`;
}

export function StorageConfig({ apiFetch }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [sections, setSections] = useState<Record<string, boolean>>({
    backend: true,
    cors: false,
    limits: true,
    upload: false,
    maintenance: false,
  });

  function toggleSection(key: string) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const toggleSecret = useCallback(async (key: string) => {
    if (revealedSecrets[key]) {
      setRevealedSecrets((prev) => ({ ...prev, [key]: false }));
      return;
    }
    try {
      const r = await apiFetch('/admin/storage/secrets');
      const d = await r.json();
      if (d[key]) setForm((f) => ({ ...f, [key]: d[key] }));
    } catch { /* */ }
    setRevealedSecrets((prev) => ({ ...prev, [key]: true }));
  }, [revealedSecrets, apiFetch]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/admin/storage')
      .then((r) => r.json())
      .then((d: StorageData) => {
        setData(d);
        const initForm: Record<string, string> = {
          backend: d.backend || 'local',
          storage_path: String(d.storage_path ?? ''),
          total_storage_limit: String(d.total_storage_limit ?? 0),
          s3_upload_enabled: String(d.s3_upload_enabled === true),
        };
        for (const key of d.setting_keys || []) {
          initForm[key] = String(d[key] ?? '');
        }
        setForm((prev) => {
          const merged = { ...initForm };
          for (const key of d.setting_keys || []) {
            if (isSecretKey(key) && prev[key] && !d[key]) {
              merged[key] = prev[key];
            }
          }
          return merged;
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSection(keys: string[]) {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const k of keys) payload[k] = form[k] ?? '';
      const r = await apiFetch('/admin/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const backends = data?.available_backends ?? {};
      const backendLabel = backends[form.backend] || form.backend;
      const msg = formatSavedMessage(d.updated, form)
        .replace(`Backend → ${form.backend}`, `Backend → ${backendLabel}`);
      toast(msg, 'ok');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setSaving(false);
    }
  }

  async function cleanupMultipart() {
    setCleaning(true);
    try {
      const r = await apiFetch('/admin/storage/cleanup-multipart', {
        method: 'POST',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.cleaned === 0) {
        toast('No unfinished multipart uploads found.', 'ok');
      } else {
        toast(`Cleaned up ${d.cleaned} unfinished multipart upload(s).`, 'ok');
      }
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setCleaning(false);
    }
  }

  const allSettingKeys: string[] = data?.setting_keys ?? [];
  const settingKeys = allSettingKeys.filter((k) => k.startsWith(`${form.backend}_`));
  const visibleKeys = settingKeys.filter((k) => !isSecretKey(k));
  const secretKeys = settingKeys.filter(isSecretKey);
  const backends = data?.available_backends ?? {};

  if (loading)
    return (
      <section className="card">
        <CardSkeleton lines={4} />
      </section>
    );
  if (!data)
    return (
      <section className="card">
        <p className="text-sm text-red-400">Failed to load storage info.</p>
      </section>
    );

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="card-title">💾 Storage Configuration</h2>
        {saved && (
          <span className="text-xs text-green-400">✓ Saved</span>
        )}
      </div>

      {/* ── Backend & Credentials ── */}
      <CollapsibleSection
        title="🔌 Backend & Credentials"
        open={sections.backend}
        onToggle={() => toggleSection('backend')}
      >
        <div>
          <label
            htmlFor="storage-backend"
            className="block text-xs text-zinc-500 mb-1"
          >
            Backend
          </label>
          <select
            id="storage-backend"
            value={form.backend}
            onChange={(e) => setForm({ ...form, backend: e.target.value })}
            className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
          >
            {Object.entries(backends).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {form.backend !== 'local' && settingKeys.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {visibleKeys.map((key) => (
              <div key={key}>
                <label htmlFor={`setting-${key}`} className="block text-xs text-zinc-500 mb-1">
                  {fieldLabel(key)}
                </label>
                <input
                  id={`setting-${key}`}
                  type="text"
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
            {secretKeys.map((key) => (
              <div key={key}>
                <label htmlFor={`setting-${key}`} className="block text-xs text-zinc-500 mb-1">
                  {fieldLabel(key)}
                </label>
                <div className="relative">
                  <input
                    id={`setting-${key}`}
                    type={revealedSecrets[key] ? 'text' : 'password'}
                    value={form[key] || ''}
                    placeholder={data[key] ? '••••••••' : ''}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3 py-2 pr-10 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <VisibilityToggle
                      isPublic={!!revealedSecrets[key]}
                      onClick={() => toggleSecret(key)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => saveSection(['backend', ...settingKeys])}
            disabled={saving}
            className="btn-green text-xs"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </CollapsibleSection>

      {/* ── CORS Settings ── */}
      <CollapsibleSection
        title="🌐 CORS Settings"
        open={sections.cors ?? false}
        onToggle={() => toggleSection('cors')}
      >
        {data.cors_supported ? (
          <CorsConfig apiFetch={apiFetch} />
        ) : (
          <p className="text-xs text-zinc-500">
            CORS settings are only available for cloud storage backends (S3, B2, etc.).
          </p>
        )}
      </CollapsibleSection>

      {/* ── Storage Path & Limits ── */}
      <CollapsibleSection
        title="📦 Storage Path & Limits"
        open={sections.limits}
        onToggle={() => toggleSection('limits')}
      >
        <div>
          <label htmlFor="storage-path" className="block text-xs text-zinc-500 mb-1">
            Storage Path / Prefix
          </label>
          <input
            id="storage-path"
            type="text"
            value={form.storage_path || ''}
            placeholder="linqoy/storage/"
            onChange={(e) => setForm({ ...form, storage_path: e.target.value })}
            className="w-full sm:w-96 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500"
          />
          <p className="text-xs text-zinc-600 mt-1">
            Key prefix in the bucket. Leave empty for no prefix.
          </p>
        </div>

        <div className="mt-3">
          <label htmlFor="total-storage-limit" className="block text-xs text-zinc-500 mb-1">
            Total App Storage Limit (bytes, 0 = unlimited)
          </label>
          <input
            id="total-storage-limit"
            type="number"
            min="0"
            value={form.total_storage_limit || '0'}
            onChange={(e) => setForm({ ...form, total_storage_limit: e.target.value })}
            className="w-full sm:w-64 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-violet-500 font-mono"
          />
          <p className="text-xs text-zinc-600 mt-1">
            0 = unlimited. Current usage shown in the metrics above.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => saveSection(['storage_path', 'total_storage_limit'])}
            disabled={saving}
            className="btn-green text-xs"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </CollapsibleSection>

      {/* ── Upload Settings ── */}
      <CollapsibleSection
        title="⚡ Upload Settings"
        open={sections.upload}
        onToggle={() => toggleSection('upload')}
      >
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div>
            <span className="text-sm font-medium text-zinc-200">
              S3 Multipart Upload
            </span>
            <p className="text-xs text-zinc-500 mt-0.5">
              Direct-to-storage chunked uploads
            </p>
          </div>
          <button
            type="button"
            aria-label={
              form.s3_upload_enabled === 'true'
                ? 'Disable S3 upload'
                : 'Enable S3 upload'
            }
            onClick={() =>
              setForm({
                ...form,
                s3_upload_enabled:
                  form.s3_upload_enabled === 'true' ? 'false' : 'true',
              })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.s3_upload_enabled === 'true' ? 'bg-green-600' : 'bg-zinc-600'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.s3_upload_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => saveSection(['s3_upload_enabled'])}
            disabled={saving}
            className="btn-green text-xs"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </CollapsibleSection>

      {/* ── Maintenance ── */}
      <CollapsibleSection
        title="🛠️ Maintenance"
        open={sections.maintenance}
        onToggle={() => toggleSection('maintenance')}
      >
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div>
            <span className="text-sm font-medium text-zinc-200">
              Clear Unfinished Multipart Files
            </span>
            <p className="text-xs text-zinc-500 mt-0.5">
              Abort all in-progress multipart uploads and clean up local chunk directories
            </p>
          </div>
          <button
            type="button"
            onClick={cleanupMultipart}
            disabled={cleaning}
            className="btn-red text-xs"
          >
            {cleaning ? 'Cleaning…' : 'Clean Up'}
          </button>
        </div>
      </CollapsibleSection>
    </section>
  );
}
