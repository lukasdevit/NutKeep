import fs from 'fs';
import path from 'path';
import { DEFAULT_UPLOAD_DIR } from '../../config/index.js';

/** Recursively collect all file paths under a directory, relative to baseDir. */
export function scanDirectory(
  dir: string,
  baseDir: string,
  files: Map<string, string>
): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(full, baseDir, files);
    } else {
      files.set(path.relative(baseDir, full), full);
    }
  }
}

/** Normalize a storage path: strip DEFAULT_UPLOAD_DIR prefix to get a relative key. */
export function toRelativePath(p: string): string {
  return p.startsWith(DEFAULT_UPLOAD_DIR) ? path.relative(DEFAULT_UPLOAD_DIR, p) : p;
}

/** Extract username from a storage path like "john/file.txt" → "john" */
export function extractUsernameFromPath(diskPath: string): string | null {
  const parts = diskPath.split(path.sep);
  const first = parts[0];
  if (first && !first.includes('.') && first.length > 0) return first;
  return null;
}

/** Resolve a MIME type from a file extension. */
export function getMimeType(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.json': 'application/json', '.txt': 'text/plain',
    '.csv': 'text/csv', '.md': 'text/markdown', '.html': 'text/html',
    '.css': 'text/css', '.xml': 'text/xml', '.js': 'application/javascript',
    '.ts': 'text/typescript', '.zip': 'application/zip', '.gz': 'application/gzip',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  };
  return map[ext] || 'application/octet-stream';
}

/** Remove empty parent directories after deleting a file. */
export function cleanEmptyDirs(absPath: string): void {
  let dir = path.dirname(absPath);
  // Walk up until we hit the base upload dir, cleaning empty dirs
  while (dir !== DEFAULT_UPLOAD_DIR && dir !== path.dirname(DEFAULT_UPLOAD_DIR)) {
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
      } else {
        break;
      }
    } catch { break; }
    dir = path.dirname(dir);
  }
}

/** Check if a file exists and return its size. */
export function statFile(absPath: string): { size: number } | null {
  try {
    return fs.statSync(absPath);
  } catch {
    return null;
  }
}

/** Move a file from src to dst, creating parent directories as needed. */
export function moveFile(src: string, dst: string): void {
  const destDir = path.dirname(dst);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.renameSync(src, dst);
}
