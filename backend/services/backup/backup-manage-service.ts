import { ERROR_CODES } from '../../errors/codes.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { DB_PATH } from '../../config/index.js';
import { recordAction } from '../action-log-service.js';

const BACKUPS_DIR = path.join(process.cwd(), 'uploads', 'backups');

function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR))
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export interface BackupFileInfo {
  filename: string;
  size: number;
  created: string;
  modified: string;
}

export function listBackupFiles(): BackupFileInfo[] {
  ensureBackupsDir();
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith('database-') && f.endsWith('.db'))
    .map((f) => {
      const filepath = path.join(BACKUPS_DIR, f);
      const stat = fs.statSync(filepath);
      return {
        filename: f,
        size: stat.size,
        created: stat.birthtime.toISOString(),
        modified: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

export function getLatestBackupPath(): { filename: string; filepath: string } | null {
  ensureBackupsDir();
  const files = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.startsWith('database-') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  const filename = files[0]!;
  return { filename, filepath: path.join(BACKUPS_DIR, filename) };
}

export async function uploadBackupFile(
  fileStream: NodeJS.ReadableStream,
  originalFilename: string,
  adminUsername?: string
): Promise<BackupFileInfo> {
  const ext = path.extname(originalFilename).toLowerCase();
  if (ext !== '.db') {
    throw Object.assign(new Error('Only .db files are accepted'), { code: ERROR_CODES.BACKUP_INVALID_FILE });
  }

  ensureBackupsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destName = `database-${timestamp}-uploaded.db`;
  const destPath = path.join(BACKUPS_DIR, destName);

  const writeStream = fs.createWriteStream(destPath);
  await new Promise<void>((resolve, reject) => {
    fileStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // Validate it's a valid SQLite database
  try {
    execSync(`sqlite3 "${destPath}" "PRAGMA integrity_check;"`, {
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch {
    fs.unlinkSync(destPath);
    throw Object.assign(
      new Error('Uploaded file is not a valid SQLite database'),
      { statusCode: 400 }
    );
  }

  const stat = fs.statSync(destPath);
  if (adminUsername) {
    await recordAction(adminUsername, 'backup-upload', `Uploaded backup: ${destName}`, { filename: destName });
  }
  return { filename: destName, size: stat.size, created: stat.birthtime.toISOString(), modified: stat.mtime.toISOString() };
}

export function deleteBackupFile(filename: string): void {
  const safe = path.basename(filename);
  if (safe !== filename || !safe.startsWith('database-') || !safe.endsWith('.db')) {
    throw Object.assign(new Error('Invalid backup filename'), { code: ERROR_CODES.BACKUP_INVALID_FILE });
  }
  const filepath = path.join(BACKUPS_DIR, safe);
  if (!fs.existsSync(filepath)) {
    throw Object.assign(new Error('Backup not found'), { code: ERROR_CODES.BACKUP_NOT_FOUND });
  }
  fs.unlinkSync(filepath);
}

export async function restoreBackupFile(
  filename: string,
  confirm: string,
  adminUsername?: string
): Promise<void> {
  if (confirm !== 'RESTORE') {
    throw Object.assign(
      new Error("Type 'RESTORE' in the confirm field to proceed"),
      { statusCode: 400 }
    );
  }

  const safe = path.basename(filename);
  if (safe !== filename || !safe.startsWith('database-') || !safe.endsWith('.db')) {
    throw Object.assign(new Error('Invalid backup filename'), { code: ERROR_CODES.BACKUP_INVALID_FILE });
  }

  const srcPath = path.join(BACKUPS_DIR, safe);
  if (!fs.existsSync(srcPath)) {
    throw Object.assign(new Error('Backup file not found'), { code: ERROR_CODES.BACKUP_NOT_FOUND });
  }

  // Validate the backup is a good SQLite database
  try {
    execSync(`sqlite3 "${srcPath}" "PRAGMA integrity_check;"`, {
      stdio: 'pipe',
      timeout: 10000,
    });
  } catch {
    throw Object.assign(
      new Error('Backup file is corrupted (integrity check failed)'),
      { statusCode: 400 }
    );
  }

  // Create a safety backup of current DB before restoring
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyBackup = path.join(BACKUPS_DIR, `database-${timestamp}-pre-restore.db`);
  fs.copyFileSync(DB_PATH, safetyBackup);

  // Replace current DB with the backup
  fs.copyFileSync(srcPath, DB_PATH);

  if (adminUsername) {
    await recordAction(adminUsername, 'backup-restore', `Restored backup: ${safe}`, { filename: safe });
  }
}
