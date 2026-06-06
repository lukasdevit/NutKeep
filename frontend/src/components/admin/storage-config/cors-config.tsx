'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

interface CorsRule {
  AllowedHeaders?: string[];
  AllowedMethods?: string[];
  AllowedOrigins?: string[];
  ExposeHeaders?: string[];
  MaxAgeSeconds?: number;
}

const PLACEHOLDER_JSON = `[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]`;

export function CorsConfig({ apiFetch }: Props) {
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  async function fetchConfig() {
    setLoading('fetch');
    try {
      const r = await apiFetch('/admin/storage/cors');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setJsonText(JSON.stringify(d.rules, null, 2));
      toast(`CORS config loaded (source: ${d.source})`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setLoading(null);
    }
  }

  async function applyConfig(rulesText?: string) {
    const text = rulesText ?? jsonText;
    let parsed: CorsRule[];
    try {
      parsed = JSON.parse(text);
    } catch {
      toast('Invalid JSON. Please check the syntax.', 'err');
      return;
    }

    setLoading('apply');
    try {
      const r = await apiFetch('/admin/storage/cors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: parsed }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setJsonText(JSON.stringify(d.rules, null, 2));
      toast('CORS configuration applied successfully', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setLoading(null);
    }
  }

  async function resetConfig() {
    setShowResetModal(false);
    setLoading('reset');
    try {
      const r = await apiFetch('/admin/storage/cors/default');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      const applyR = await apiFetch('/admin/storage/cors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: d.rules }),
      });
      const applyD = await applyR.json();
      if (!applyR.ok) throw new Error(applyD.error);

      setJsonText(JSON.stringify(applyD.rules, null, 2));
      toast('CORS configuration reset to default', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setLoading(null);
    }
  }

  const isBusy = loading !== null;

  return (
    <>
      <div className="space-y-3 p-4 rounded-lg bg-zinc-800/30 border border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-200">
          🌐 CORS Settings
        </h3>

        <p className="text-xs text-zinc-500">
          Configure Cross-Origin Resource Sharing for the storage bucket. Changes apply to
          browser-based multipart uploads.
        </p>

        <div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={PLACEHOLDER_JSON}
            rows={14}
            spellCheck={false}
            className="w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono focus:outline-none focus:border-violet-500 resize-y"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchConfig}
            disabled={isBusy}
            className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            {loading === 'fetch' ? 'Loading…' : 'Get current settings'}
          </button>

          <button
            type="button"
            onClick={() => applyConfig()}
            disabled={isBusy || !jsonText.trim()}
            className="px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            {loading === 'apply' ? 'Applying…' : 'Apply settings'}
          </button>

          <button
            type="button"
            onClick={() => applyConfig(PLACEHOLDER_JSON)}
            disabled={isBusy}
            className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            Apply Recommended
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={isBusy}
            className="px-3 py-1.5 rounded-md bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
          >
            {loading === 'reset' ? 'Resetting…' : 'Reset settings'}
          </button>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-200 mb-2">
              Reset CORS Configuration?
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              This will overwrite the current CORS configuration with the default safe
              settings. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isBusy}
                className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={resetConfig}
                disabled={isBusy}
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-xs font-medium text-white transition-colors"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
