import path from 'path';
import { nanoid } from 'nanoid';

import { sanitizeFilename, validateFile, checkStorageQuota } from '../../services/files/index.js';
import { buildStorageKey } from '../../services/storage/index.js';

/**
 * Common init validation shared by multipart and local-chunked upload routes.
 * Validates filename/mime, checks quota, generates storage filename + key.
 * Throws on validation/quota errors (caller should wrap with try/catch → reply).
 */
export async function prepareUploadInit(
  body: { filename: string; mimeType: string; totalSize?: number },
  userId: number,
  username: string
) {
  const originalName = sanitizeFilename(body.filename);

  const validationError = validateFile(body.mimeType, originalName);
  if (validationError) {
    throw Object.assign(new Error(validationError), { statusCode: 415 });
  }

  await checkStorageQuota(body.totalSize ?? 1, userId);

  const id = nanoid(10);
  const ext = path.extname(originalName);
  const filename = `${id}${ext}`;
  const storageKey = await buildStorageKey(username, filename);

  return { originalName, filename, storageKey };
}
