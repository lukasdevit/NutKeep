'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';

interface SslData {
  domain: string;
  is_local: boolean;
  protocol: string;
  cert_valid: boolean;
  cert_expiry: string | null;
  managed_by: string;
  note: string;
}

interface Props {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

export function SslConfig({ apiFetch }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<SslData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());
  const [customCert, setCustomCert] = useState<{
    has_custom_cert: boolean;
    cert_expiry: string | null;
  } | null>(null);
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch('/admin/ssl')
      .then((r) => r.json())
      .then((d: SslData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    apiFetch('/admin/ssl/cert')
      .then((r) => r.json())
      .then(setCustomCert)
      .catch(() => {});
  }, [apiFetch]);

  async function uploadCert() {
    if (!certPem.trim() || !keyPem.trim()) return;
    setUploading(true);
    try {
      const r = await apiFetch('/admin/ssl/cert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert: certPem, key: keyPem }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast('Certificate uploaded and applied', 'ok');
      setCertPem('');
      setKeyPem('');
      const cr = await apiFetch('/admin/ssl/cert');
      setCustomCert(await cr.json());
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setUploading(false);
    }
  }

  async function deleteCert() {
    setDeleting(true);
    try {
      const r = await apiFetch('/admin/ssl/cert', { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error);
      toast('Custom certificate removed — using auto TLS', 'ok');
      setCustomCert({ has_custom_cert: false, cert_expiry: null });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setDeleting(false);
    }
  }

  const expiryDate = data?.cert_expiry ? new Date(data.cert_expiry) : null;
  const daysLeft = expiryDate
    ? Math.ceil((expiryDate.getTime() - now) / (1000 * 60 * 60 * 24))
    : null;

  if (loading)
    return (
      <section className="card">
        <p className="text-sm text-zinc-500">Loading…</p>
      </section>
    );
  if (!data)
    return (
      <section className="card">
        <p className="text-sm text-red-400">Failed to load SSL info.</p>
      </section>
    );

  return (
    <section className="card space-y-5">
      <h2 className="card-title">🔒 SSL / HTTPS</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SslCard label="Domain" value={data.domain} large />
        <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <span className="text-xs text-zinc-500">Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${data.cert_valid ? 'bg-green-400' : data.is_local ? 'bg-amber-400' : 'bg-red-400'}`}
            />
            <p className="text-sm font-medium text-zinc-200">
              {data.cert_valid
                ? '✅ HTTPS Active'
                : data.is_local
                  ? '🔸 Localhost (no SSL)'
                  : '❌ No certificate'}
            </p>
          </div>
        </div>
      </div>

      {data.cert_valid && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SslCard
            label="Certificate expires"
            value={data.cert_expiry || 'Unknown'}
          >
            {daysLeft !== null && (
              <p
                className={`text-xs mt-1 ${daysLeft < 30 ? 'text-red-400' : daysLeft < 60 ? 'text-amber-400' : 'text-green-400'}`}
              >
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
              </p>
            )}
          </SslCard>
          <SslCard label="Managed by" value={data.managed_by} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SslCard label="Protocol" value={(data.protocol || 'http').toUpperCase()} />
        <SslCard
          label="Auto-renewal"
          value={data.is_local ? 'N/A' : '✅ Enabled'}
        />
      </div>

      <div
        className={`p-3 rounded-lg text-xs ${data.is_local ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-green-500/10 border border-green-500/20 text-green-300'}`}
      >
        {data.note}
      </div>

      {/* Custom certificate upload */}
      <div className="border-t border-zinc-800 pt-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            📜 Custom SSL Certificate
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Upload your own certificate instead of using Let&apos;s Encrypt auto-TLS.
          </p>
        </div>

        {customCert?.has_custom_cert ? (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400">✅ Custom certificate active</p>
            {customCert.cert_expiry && (
              <p className="text-xs text-green-500/70 mt-1">
                Expires: {new Date(customCert.cert_expiry).toLocaleDateString()}
              </p>
            )}
            <button
              type="button"
              onClick={deleteCert}
              disabled={deleting}
              className="btn-red text-xs mt-3"
            >
              {deleting ? 'Removing…' : '🗑 Remove Custom Cert'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="cert-pem" className="block text-xs text-zinc-500 mb-1">
                Certificate (PEM)
              </label>
              <textarea
                id="cert-pem"
                rows={4}
                value={certPem}
                onChange={(e) => setCertPem(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono focus:outline-none focus:border-violet-500 resize-y"
              />
            </div>
            <div>
              <label htmlFor="key-pem" className="block text-xs text-zinc-500 mb-1">
                Private Key (PEM)
              </label>
              <textarea
                id="key-pem"
                rows={4}
                value={keyPem}
                onChange={(e) => setKeyPem(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-mono focus:outline-none focus:border-violet-500 resize-y"
              />
            </div>
            <button
              type="button"
              onClick={uploadCert}
              disabled={uploading || !certPem.trim() || !keyPem.trim()}
              className="btn-green text-xs"
            >
              {uploading ? 'Uploading…' : '📤 Upload Certificate'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SslCard({
  label,
  value,
  large,
  children,
}: {
  label: string;
  value: string;
  large?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
      <span className="text-xs text-zinc-500">{label}</span>
      <p
        className={`${large ? 'text-lg font-semibold' : 'text-sm font-medium'} text-zinc-200 mt-0.5`}
      >
        {value}
      </p>
      {children}
    </div>
  );
}
