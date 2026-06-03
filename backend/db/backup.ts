import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  DB_PATH,
  BACKUP_RETRY_MAX,
  BACKUP_RETRY_BASE_MS,
} from '../config/index.js';
import { dbRun } from './helpers.js';
import type { StorageProvider } from '../services/storage/types.js';
import { rotateBackups } from '../services/storage/backup-rotation.js';

interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

/**
 * Create a safe SQLite backup and return its temp file path + readable stream.
 * Uses sqlite3 .backup command (transactional), falls back to file copy.
 */
export function createBackup(
  log?: Logger
): {
  filepath: string;
  stream: NodeJS.ReadableStream;
  timestamp: string;
  size: number;
} | null {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(os.tmpdir(), `linqoy-backup-${timestamp}.db`);

  let size = 0;
  try {
    execSync(`sqlite3 "${DB_PATH}" ".backup '${dest}'"`, { stdio: 'pipe' });
    size = fs.statSync(dest).size;
    log?.info(`Backup snapshot created: ${dest} (${size} bytes)`);
  } catch {
    try {
      fs.copyFileSync(DB_PATH, dest);
      size = fs.statSync(dest).size;
      log?.info(
        `Backup snapshot created (copy fallback): ${dest} (${size} bytes)`
      );
    } catch (err) {
      log?.warn(`Backup snapshot failed: ${(err as Error).message}`);
      return null;
    }
  }

  const stream = fs.createReadStream(dest);
  return { filepath: dest, stream, timestamp, size };
}

/**
 * Push a backup to a single storage provider with retry + backoff.
 * Logs result to backup_logs table.
 */
export async function backupToStorage(
  provider: StorageProvider,
  backup: {
    filepath: string;
    stream: NodeJS.ReadableStream;
    timestamp: string;
    size: number;
  },
  keyPrefix = 'backups/',
  destinationLabel = 'local',
  log?: Logger
): Promise<{ ok: boolean; error?: string }> {
  const key = `${keyPrefix.replace(/\/$/, '')}/database-${backup.timestamp}.db`;
  const timestamp = new Date().toISOString();

  for (let attempt = 1; attempt <= BACKUP_RETRY_MAX; attempt++) {
    try {
      const stream = fs.createReadStream(backup.filepath);
      await provider.save(key, stream);
      stream.destroy();

      log?.info(`Backup uploaded to ${destinationLabel}: ${key}`);
      await logBackup(timestamp, destinationLabel, 'ok', backup.size);
      return { ok: true };
    } catch (err) {
      const msg = (err as Error).message;
      log?.warn(
        `Backup attempt ${attempt}/${BACKUP_RETRY_MAX} to ${destinationLabel} failed: ${msg}`
      );

      if (attempt < BACKUP_RETRY_MAX) {
        const delay = BACKUP_RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        await logBackup(timestamp, destinationLabel, 'fail', backup.size, msg);
        return { ok: false, error: msg };
      }
    }
  }

  return { ok: false, error: 'unknown' };
}

/**
 * Create a database backup and push it to one or more storage providers.
 * Retries each destination independently with exponential backoff.
 * Logs all attempts to backup_logs table.
 * Cleans up the temp file after all uploads.
 *
 * @example
 * // Local + cloud
 * backupDatabase(app.log,
 *   { provider: new LocalStorage(), keyPrefix: "backups", label: "local", keep: 7 },
 *   { provider: new B2Storage(), keyPrefix: "backups/db", label: "b2" },
 * );
 */
export async function backupDatabase(
  log: Logger,
  ...destinations: {
    provider: StorageProvider;
    keyPrefix?: string;
    label?: string;
    retentionDays?: number;
  }[]
): Promise<{
  ok: boolean;
  results: { label: string; ok: boolean; error?: string }[];
}> {
  if (destinations.length === 0) return { ok: true, results: [] };

  const backup = createBackup(log);
  if (!backup) return { ok: false, results: [] };

  const results = await Promise.all(
    destinations.map((d) =>
      backupToStorage(
        d.provider,
        backup,
        d.keyPrefix,
        d.label ?? 'unknown',
        log
      ).then((r) => ({ label: d.label ?? 'unknown', ...r }))
    )
  );

  // Rotate old backups for destinations with retentionDays
  for (const d of destinations) {
    if (d.retentionDays && d.retentionDays > 0) {
      await rotateBackups(d.provider, d.keyPrefix ?? 'backups/', d.retentionDays, log);
    }
  }

  try {
    fs.unlinkSync(backup.filepath);
  } catch {
    /* best effort */
  }

  const succeeded = results.filter((r) => r.ok).length;
  const total = destinations.length;
  if (succeeded === 0 && total > 0) {
    log.warn('All backup destinations failed');
  } else if (succeeded < total) {
    log.warn(`Backup completed: ${succeeded}/${total} destinations OK`);
  } else {
    log.info('Backup completed successfully');
  }

  return { ok: succeeded > 0, results };
}

/** Write a backup attempt to the backup_logs table. */
async function logBackup(
  timestamp: string,
  destination: string,
  status: string,
  sizeBytes?: number,
  error?: string
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO backup_logs (timestamp, destination, status, size_bytes, error) VALUES (?, ?, ?, ?, ?)`,
      [timestamp, destination, status, sizeBytes ?? null, error ?? null]
    );
  } catch {
    /* logging failure shouldn't break backup */
  }
}
