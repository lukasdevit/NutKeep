import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';

import { checkStorageQuota } from './quota.js';
import { finalizeFile } from './finalize.js';
import { scanFile } from '../../utils/scan.js';
import { getStorage, buildStorageKey } from '../storage/index.js';

export async function saveFile(
  fileStream: NodeJS.ReadableStream,
  filename: string,
  originalName: string,
  mimeType: string,
  userId?: number,
  expiresInDays?: number
): Promise<string> {
  const storage = await getStorage();
  const storageKey = userId
    ? await buildStorageKey(userId, filename)
    : `anonymous/${filename}`;

  // Stream to temp file first (needed for size check + virus scan)
  const tmpPath = path.join(os.tmpdir(), `nutkeep-${filename}`);
  let size = 0;
  try {
    await pipeline(fileStream, fs.createWriteStream(tmpPath));
    const stats = fs.statSync(tmpPath);
    size = stats.size;

    // Single quota check — covers both global limit and per-user quota
    await checkStorageQuota(size, userId);

    const scanResult = await scanFile(tmpPath);
    if (!scanResult.clean) {
      throw Object.assign(
        new Error(
          'This file could not be uploaded because it may contain malware.'
        ),
        { statusCode: 422 }
      );
    }

    const readStream = fs.createReadStream(tmpPath);
    await storage.save(storageKey, readStream);
  } finally {
    // Always clean up the temp file, even if the process crashes mid-way.
    // Note: a hard kill (-9) will still leak — consider a cron-based
    // tmpdir cleanup as an additional safety net.
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* temp file may already be gone */
    }
  }

  const base = { filename, originalName, storageKey, mimeType, size };
  const fileParams: typeof base & { userId?: number; expiresInDays?: number } = { ...base };
  if (userId !== undefined) fileParams.userId = userId;
  if (expiresInDays !== undefined) fileParams.expiresInDays = expiresInDays;
  return finalizeFile(fileParams);
}
