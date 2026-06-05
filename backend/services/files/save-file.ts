import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';

import { saveFromPath } from './save-from-path.js';

export async function saveFile(
  fileStream: NodeJS.ReadableStream,
  filename: string,
  originalName: string,
  mimeType: string,
  userId: number,
  username: string,
  expiresInDays?: number
): Promise<string> {
  // Stream to temp file first, then delegate to shared saveFromPath
  const tmpPath = path.join(os.tmpdir(), `linqoy-${filename}`);
  try {
    await pipeline(fileStream, fs.createWriteStream(tmpPath));
    return await saveFromPath(
      tmpPath,
      filename,
      originalName,
      mimeType,
      userId,
      username,
      expiresInDays
    );
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* already gone */ }
  }
}
