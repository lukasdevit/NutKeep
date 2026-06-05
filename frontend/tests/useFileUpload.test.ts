import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileUpload } from '@/hooks/use-file-upload';

/**
 * Creates a fetch mock that simulates the local chunked upload flow:
 *   1. POST /upload/local/init     → { data: { uploadId: "mock-id" } }
 *   2. POST /upload/local/part?…   → 200 OK (per chunk)
 *   3. POST /upload/local/complete → { data: { url: "/file/test.txt" } }
 */
function mockFetchForChunkedUpload(overrides?: {
  initError?: string;
  partError?: string;
}) {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes('/upload/local/init')) {
      if (overrides?.initError) {
        return new Response(JSON.stringify({ error: overrides.initError }), { status: 400 });
      }
      return new Response(JSON.stringify({ data: { uploadId: 'mock-upload-id' } }), { status: 200 });
    }
    if (urlStr.includes('/upload/local/part')) {
      if (overrides?.partError) {
        return new Response(JSON.stringify({ error: overrides.partError }), { status: 400 });
      }
      return new Response(null, { status: 200 });
    }
    if (urlStr.includes('/upload/local/complete')) {
      return new Response(JSON.stringify({ data: { url: '/file/test.txt' } }), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
}

describe('useFileUpload', () => {
  let api: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = vi.fn();
    fetchMock = mockFetchForChunkedUpload();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads a file and calls onSuccess', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileUpload(api, 'test-token'));

    await act(async () => {
      await result.current.uploadFile(file, onSuccess);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/upload/local/init'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(result.current.uploading).toBe(false);
  });

  it('tracks upload progress', async () => {
    const file = new File(['x'.repeat(100)], 'big.bin', { type: 'application/octet-stream' });
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileUpload(api, 'test-token'));

    await act(async () => {
      await result.current.uploadFile(file, onSuccess);
    });

    // After upload, progress should be 100%
    expect(result.current.uploadProgress).toBe(100);
  });

  it('sets dragOver via setDragOver', () => {
    const { result } = renderHook(() => useFileUpload(api, null));

    act(() => {
      result.current.setDragOver(true);
    });
    expect(result.current.dragOver).toBe(true);

    act(() => {
      result.current.setDragOver(false);
    });
    expect(result.current.dragOver).toBe(false);
  });
});
