'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/lib/api-client';
import { getApiErrorMessage } from '@/lib/api-error';
import { Uppy } from '@uppy/core';
import AwsS3Multipart from '@uppy/aws-s3';

/**
 * Hook that manages Uppy initialization and S3 multipart upload lifecycle.
 * Returns refs and state for use by a dumb upload UI component.
 */
export function useUppyUpload(s3Enabled: boolean, token: string | null, onUploadComplete?: () => Promise<void>) {
  const uppyRef = useRef<Uppy | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [expireDays, setExpireDays] = useState('');

  const authHeaders = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  useEffect(() => {
    if (!s3Enabled) {
      if (uppyRef.current) {
        uppyRef.current.destroy();
        uppyRef.current = null;
      }
      return;
    }
    if (uppyRef.current) return;

    const uppy = new Uppy({
      autoProceed: true,
      restrictions: { maxFileSize: 5 * 1024 * 1024 * 1024 },
      onBeforeFileAdded: (file: any) => {
        file.meta = { ...file.meta, filename: file.name, mimeType: file.type || 'application/octet-stream' };
        return true;
      },
    });

    uppy.use(AwsS3Multipart, {
      shouldUseMultipart: true,
      limit: 1,
      createMultipartUpload: async (file: any) => {
        const res = await fetch(`${API_BASE}/upload/multipart/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/octet-stream' }),
        });
        const json: any = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(json, res.status));
        return { uploadId: json.data.uploadId, key: json.data.key };
      },
      signPart: async (_file: any, opts: any) => {
        const { uploadId, key, partNumber } = opts;
        const res = await fetch(`${API_BASE}/upload/multipart/sign-part`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ key, uploadId, partNumber }),
        });
        const json: any = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(json, res.status));
        return { url: json.data.url };
      },
      listParts: async () => [],
      completeMultipartUpload: async (file: any, opts: any) => {
        const { uploadId, key, parts } = opts;
        const res = await fetch(
          `${API_BASE}/upload/multipart/${encodeURIComponent(uploadId)}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              key,
              parts: (parts as any[]).map((p: any) => ({ PartNumber: p.PartNumber, ETag: p.ETag })),
              originalName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              expiresInDays: expireDays ? parseInt(expireDays, 10) : undefined,
            }),
          }
        );
        const json: any = await res.json();
        if (!res.ok) throw new Error(getApiErrorMessage(json, res.status));
        return { location: json.data.url };
      },
      abortMultipartUpload: async (_file: any, opts: any) => {
        const { uploadId, key } = opts;
        await fetch(`${API_BASE}/upload/multipart/${encodeURIComponent(uploadId)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ key }),
        }).catch(() => {});
      },
    });

    uppy.on('progress', (progress: number) => setUploadProgress(progress));
    uppy.on('upload', () => setUploading(true));
    uppy.on('complete', () => { setUploading(false); setUploadProgress(0); if (onUploadComplete) onUploadComplete(); });
    uppy.on('error', (_err: Error) => { setUploading(false); });

    uppyRef.current = uppy;

    return () => {
      uppy.destroy();
      uppyRef.current = null;
    };
  }, [s3Enabled, token, authHeaders, expireDays]);

  const addFiles = useCallback((files: File[]) => {
    if (!uppyRef.current) return;
    setError(null);
    setUploadCount({ done: 0, total: files.length });
    files.forEach((f) => uppyRef.current!.addFile({ name: f.name, type: f.type, data: f }));
  }, []);

  return {
    uppyRef,
    uploading, setUploading,
    uploadProgress, setUploadProgress,
    uploadCount, setUploadCount,
    error, setError,
    expireDays, setExpireDays,
    addFiles,
  };
}
