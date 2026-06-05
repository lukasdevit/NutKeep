// Side-effect imports: each provider self-registers via registerProvider()
import './b2/index.js';
import './r2/index.js';

import { getStorageBackend, getStoragePath } from '../../config/index.js';
import { LocalStorage } from './local.js';
import { registerProvider, resolveProvider, allSettingKeys, allProviders } from './providers.js';
import type { StorageProvider } from './types.js';
import type { S3Client } from '@aws-sdk/client-s3';

export type { StorageProvider } from './types.js';

// Cached storage path for the local provider factory (populated on first getStorage() call)
let _cachedLocalPath: string | undefined;

// Local storage is always available — factory uses cached configured path
registerProvider('local', () => new LocalStorage(_cachedLocalPath), [], '💻 Local filesystem');

/** All admin-configurable setting keys, aggregated from every registered provider. */
export const STORAGE_SETTING_KEYS = allSettingKeys();

export { resolveProvider, allProviders };

let _storage: StorageProvider;

/** Clear cached storage instance and local path — call after admin changes storage settings. */
export function clearStorageCache(): void {
  _storage = undefined as unknown as StorageProvider;
  _cachedLocalPath = undefined;
}

/** Ensure the local storage path cache is populated. Call early in bootstrap. */
export async function initLocalPath(): Promise<void> {
  if (_cachedLocalPath === undefined) {
    const path = await getStoragePath();
    _cachedLocalPath = path || undefined;
  }
}

export async function getStorage(): Promise<StorageProvider> {
  if (!_storage) {
    const [backend, configuredPath] = await Promise.all([
      getStorageBackend(),
      getStoragePath(),
    ]);
    if (backend === 'local') {
      _cachedLocalPath = configuredPath || undefined;
    }
    _storage = backend === 'local'
      ? new LocalStorage(_cachedLocalPath)
      : resolveProvider(backend);
    console.warn(`Storage: ${backend}`);
  }
  return _storage;
}

export async function buildStorageKey(username: string, filename: string): Promise<string> {
  const base = `${username}/${filename}`;

  const backend = await getStorageBackend();
  if (backend === 'local') {
    // For local storage, LocalStorage already uses storagePath as baseDir,
    // so the key must be relative — no prefix.
    return base;
  }

  // For cloud backends (B2/R2), prefix is a key prefix in the bucket.
  const prefix = await getStoragePath();
  return prefix ? `${prefix.replace(/\/$/, '')}/${base}` : base;
}

/** Resolve the S3 client for the currently configured cloud backend (B2 or R2). */
export async function getCurrentS3Client(): Promise<{ client: S3Client; bucket: string }> {
  const backend = await getStorageBackend();
  if (backend === 'b2') {
    const { getS3Client, getBucket } = await import('./b2/client.js');
    return { client: await getS3Client(), bucket: await getBucket() };
  }
  if (backend === 'r2') {
    const { getS3Client, getBucket } = await import('./r2/client.js');
    return { client: await getS3Client(), bucket: await getBucket() };
  }
  throw new Error(`S3 multipart upload not supported for backend: ${backend}`);
}
