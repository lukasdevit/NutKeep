import path from 'path';

function envOrCrash(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} is required. Set it in .env`);
  return val;
}

export const PORT = 3000;
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
export const LOG_PRETTY = process.env.LOG_PRETTY === 'true';
export const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const CORS_ORIGIN = process.env.CORS_ORIGIN || true;
export const DOMAIN = process.env.DOMAIN || 'localhost';

export const JWT_SECRET = envOrCrash('JWT_SECRET');
export const JWT_EXPIRES_IN = '7d';

export const ADMIN_USERNAME = envOrCrash('ADMIN_USERNAME');
export const ADMIN_PASSWORD = envOrCrash('ADMIN_PASSWORD');

export const RATE_LIMIT_MAX = 300;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const AUTH_LOGIN_LIMIT = 5;
export const AUTH_REGISTER_LIMIT = 3;
export const AUTH_RATE_WINDOW_MS = 60_000;

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 1;

export const DEFAULT_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB per user
export async function getTotalStorageLimit(): Promise<number> {
  const db = await loadDbSettings();
  const raw = db['total_storage_limit'] || '0';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0; // 0 = unlimited
}

export const DEMO_STORAGE_LIMIT = 100 * 1024 * 1024; // 100 MB
export const DEMO_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
export const DEMO_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
export const DEMO_GLOBAL_RATE_LIMIT = 10; // max demo creations per minute (global)
export const DEMO_IP_RATE_LIMIT = 2; // max demo creations per minute per IP
export const DEMO_RATE_WINDOW_MS = 60_000; // 1 minute

// Lazy-loaded from DB (admin panel overrides)
let _dbSettings: Record<string, string> | null = null;

async function loadDbSettings(): Promise<Record<string, string>> {
  if (_dbSettings) return _dbSettings;
  try {
    const { getAllSettings } = await import('../repositories/settings-repository.js');
    _dbSettings = await getAllSettings();
  } catch {
    _dbSettings = {};
  }
  return _dbSettings;
}

/** Clear cached DB settings — call after admin config changes */
export function clearConfigCache(): void {
  _dbSettings = null;
}

function dbOrEnv(key: string, envFallback: string, db: Record<string, string>): string {
  return db[key] || envFallback;
}

export type StorageBackend = 'local' | 'b2' | 'r2';

export async function getStorageBackend(): Promise<StorageBackend> {
  const db = await loadDbSettings();
  const backend = db.backend || 'local';
  if (backend === 'local' || backend === 'b2' || backend === 'r2') return backend;
  return 'local';
}

/** Read a setting for the active storage backend, e.g. getStorageSetting('endpoint') → reads b2_endpoint */
export async function getStorageSetting(key: string): Promise<string> {
  const backend = await getStorageBackend();
  const db = await loadDbSettings();
  const dbKey = `${backend}_${key}`;
  const envKey = dbKey.toUpperCase();
  return dbOrEnv(dbKey, process.env[envKey] || '', db);
}

/** DB-backed storage path — local directory when backend is local, key prefix when B2. */
export async function getStoragePath(): Promise<string> {
  const db = await loadDbSettings();
  if (db['storage_path']) return db['storage_path'];
  const backend = await getStorageBackend();
  return backend === 'local' ? DEFAULT_UPLOAD_DIR : 'nutkeep/storage/';
}

export const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), 'database.db');

export async function getBackupScheduleHours(): Promise<number> {
  const db = await loadDbSettings();
  const raw = db['backup_schedule_hours'] || '6';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
}
export async function getBackupRetentionDays(): Promise<number> {
  const db = await loadDbSettings();
  const raw = db['backup_retention_days'] || '3';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}
export const BACKUP_RETRY_MAX = 3;
export const BACKUP_RETRY_BASE_MS = 1000;
