'use client';

import { useState, useCallback, useRef } from 'react';
import { API_BASE } from '@/lib/api-client';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Upload a single file using local chunked upload.
 * Splits file into 5 MB chunks and streams them to /upload/local/* endpoints.
 */
async function uploadFileChunked(
  file: File,
  token: string | null,
  expiry: string,
  onProgress: (pct: number) => void
): Promise<string> {
  const totalParts = Math.ceil(file.size / CHUNK_SIZE) || 1;

  // 1. Init
  const initRes = await fetch(`${API_BASE}/upload/local/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalParts,
      totalSize: file.size,
      ...(expiry ? { expiresInDays: parseInt(expiry, 10) || undefined } : {}),
    }),
  });
  if (!initRes.ok) {
    const d = await initRes.json().catch(() => ({ error: 'Init failed' }));
    throw new Error(d.error || 'Init failed');
  }
  const { data } = await initRes.json();
  const uploadId: string = data.uploadId;

  // 2. Upload each chunk
  for (let part = 1; part <= totalParts; part++) {
    const start = (part - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const partRes = await fetch(
      `${API_BASE}/upload/local/part?uploadId=${encodeURIComponent(uploadId)}&partNumber=${part}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          ...authHeaders(token),
        },
        body: chunk,
      }
    );
    if (!partRes.ok) {
      const d = await partRes.json().catch(() => ({ error: 'Part upload failed' }));
      throw new Error(d.error || `Part ${part} failed`);
    }

    onProgress(Math.round((part / totalParts) * 100));
  }

  // 3. Complete
  const completeRes = await fetch(`${API_BASE}/upload/local/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ uploadId }),
  });
  if (!completeRes.ok) {
    const d = await completeRes.json().catch(() => ({ error: 'Complete failed' }));
    throw new Error(d.error || 'Complete failed');
  }
  const result = await completeRes.json();
  return result.data.url as string;
}

/**
 * Hook for file upload with chunked upload + progress tracking and drag-and-drop support.
 */
export function useFileUpload(
  api: (path: string, options?: RequestInit) => Promise<Response>,
  token: string | null
) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expireDays, setExpireDays] = useState('');

  const uploadFile = useCallback(
    async (
      fileOrFiles: File | File[],
      onSuccess: () => Promise<void>,
      expireDaysOverride?: string
    ) => {
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
      if (files.length === 0) return;

      setUploading(true);
      setUploadProgress(0);
      setUploadCount({ done: 0, total: files.length });
      setError(null);

      const expiry = expireDaysOverride ?? expireDays;

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        try {
          await uploadFileChunked(file, token, expiry, setUploadProgress);
        } catch (err) {
          setError(`${file.name}: ${(err as Error).message}`);
          setUploading(false);
          return;
        }

        setUploadCount({ done: i + 1, total: files.length });
      }

      setUploading(false);
      await onSuccess();
    },
    [token, expireDays]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, onSuccess: () => Promise<void>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFile(Array.from(e.dataTransfer.files), onSuccess);
      }
    },
    [uploadFile]
  );

  return {
    uploading,
    uploadProgress,
    uploadCount,
    dragOver,
    error,
    expireDays,
    fileInputRef,
    uploadFile,
    handleDrop,
    setDragOver,
    setError,
    setExpireDays,
  };
}
