import fs from 'fs';

import { checkStorageQuota } from './quota.js';
import { finalizeFile } from './finalize.js';
import { scanFile } from '../../utils/scan.js';
import { getStorage, buildStorageKey } from '../storage/index.js';
import { getMaxFileSize } from '../../config/index.js';
import { getMaxFileSize as getUserMaxFileSize } from '../../repositories/user-repository.js';
import { ERROR_CODES } from '../../errors/codes.js';
import { formatBytes } from '../../utils/index.js';

/**
 * Core file finalization: virus scan → storage save → DB record.
 * Used by both direct upload (saveFile) and chunked upload (local-chunked complete).
 *
 * Caller is responsible for cleaning up tmpPath after this returns.
 */
export async function saveFromPath(
  tmpPath: string,
  filename: string,
  originalName: string,
  mimeType: string,
  userId: number,
  username: string,
  expiresInDays?: number,
  expectedSize?: number
): Promise<string> {
  const stats = fs.statSync(tmpPath);
  const size = stats.size;

  if (expectedSize !== undefined && size !== expectedSize) {
    throw Object.assign(
      new Error(`Size mismatch: expected ${expectedSize}, got ${size}`),
      { code: ERROR_CODES.UPLOAD_SIZE_MISMATCH }
    );
  }

  // Check per-user max file size first, then fall back to global max file size
  const userMaxFileSize = await getUserMaxFileSize(userId);
  const effectiveMaxFileSize = userMaxFileSize !== null
    ? userMaxFileSize
    : await getMaxFileSize();

  if (effectiveMaxFileSize > 0 && size > effectiveMaxFileSize) {
    throw Object.assign(
      new Error(`File too large. Max allowed size is ${formatBytes(effectiveMaxFileSize)}.`),
      { code: ERROR_CODES.UPLOAD_FILE_TOO_LARGE }
    );
  }

  await checkStorageQuota(size, userId);

  const scanResult = await scanFile(tmpPath);
  if (!scanResult.clean) {
    throw Object.assign(
      new Error('This file could not be uploaded because it may contain malware.'),
      { code: ERROR_CODES.UPLOAD_MALWARE_DETECTED }
    );
  }

  const storage = await getStorage();
  const storageKey = await buildStorageKey(username, filename);
  const readStream = fs.createReadStream(tmpPath);
  await storage.save(storageKey, readStream);

  await finalizeFile({
    filename,
    originalName,
    storageKey,
    mimeType,
    size,
    userId,
    ...(expiresInDays !== undefined ? { expiresInDays } : {}),
  });

  return storageKey;
}
