import path from 'path';

import { nanoid } from 'nanoid';
import { BASE_URL } from '../../config/index.js';
import { sanitizeFilename } from '../../utils/sanitize-filename.js';
import { validateFile } from '../../utils/validate-file.js';
import { saveFile } from './save-file.js';

/** Shared upload handler (used by /upload and /sharex/upload). */
export async function handleUpload(
  file: { filename: string; mimetype: string; file: NodeJS.ReadableStream },
  userId: number,
  username: string,
  expiresInDays?: number
): Promise<{ url: string }> {
  const originalName = sanitizeFilename(file.filename);

  const validationError = validateFile(file.mimetype, originalName);
  if (validationError) {
    throw Object.assign(new Error(validationError), { statusCode: 415 });
  }

  const id = nanoid(10);
  const ext = path.extname(file.filename);
  const filename = `${id}${ext}`;

  await saveFile(
    file.file,
    filename,
    originalName,
    file.mimetype,
    userId,
    username,
    expiresInDays
  );

  return { url: `${BASE_URL}/file/${filename}` };
}
