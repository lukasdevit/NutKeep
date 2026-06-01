import fs from 'fs';
import path from 'path';
import { DEFAULT_UPLOAD_DIR } from '../config/index.js';

const LOG_DIR = path.join(DEFAULT_UPLOAD_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const RING_SIZE = 2000;

interface LogEntry {
  time: string;
  level: number;
  levelName: string;
  msg: string;
  reqId?: string;
  user?: string | undefined;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number | undefined;
  body?: unknown;
  err?: unknown;
}

const ring: LogEntry[] = [];

function ensureDir(): void {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LEVEL_NAMES: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

// ---- Body logging guards ----

const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'currentPassword',
  'newPassword',
  'secret',
  'apiKey',
  'authorization',
]);

const MAX_BODY_LOG_BYTES = 2048;

/** Deep-redact sensitive fields from an object (mutates a clone). */
function sanitizeBody(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return (obj as unknown[]).map(sanitizeBody);
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      clone[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      clone[key] = sanitizeBody(val);
    } else {
      clone[key] = val;
    }
  }
  return clone;
}

function formatBodyForLog(entry: LogEntry): string | undefined {
  if (!entry.body) return undefined;

  // Never log auth endpoints, even in debug mode
  if (entry.url && /^\/auth\//.test(entry.url)) return undefined;

  // Only log bodies when explicitly enabled (default OFF on prod)
  if (process.env.DEBUG_LOG_BODIES !== 'true') return undefined;

  const sanitized = sanitizeBody(entry.body);
  const json = JSON.stringify(sanitized);
  if (json.length > MAX_BODY_LOG_BYTES) return '[BODY_TOO_LARGE]';
  return json;
}

function formatLogLine(entry: LogEntry): string {
  const level = LEVEL_NAMES[entry.level] || String(entry.level);
  let line = `${entry.time} [${level}] ${entry.msg}`;
  if (entry.reqId) line += ` req=${entry.reqId}`;
  if (entry.user) line += ` user=${entry.user}`;
  if (entry.method && entry.url) line += ` ${entry.method} ${entry.url}`;
  if (entry.statusCode) line += ` status=${entry.statusCode}`;
  if (entry.responseTime !== undefined) line += ` ${entry.responseTime}ms`;
  const bodyStr = formatBodyForLog(entry);
  if (bodyStr) line += ` body=${bodyStr}`;
  if (entry.err) {
    const errObj = entry.err as Record<string, unknown>;
    line += ` err=${errObj.message || JSON.stringify(entry.err)}`;
  }
  return line;
}

/**
 * Write a log entry to the ring buffer and disk.
 * Call this from a pino transport or from Fastify hooks.
 */
export function writeLog(entry: LogEntry): void {
  // Ring buffer
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();

  // Disk (best-effort, non-blocking)
  try {
    ensureDir();
    fs.appendFileSync(LOG_FILE, formatLogLine(entry) + '\n');
  } catch {
    /* log write failure shouldn't crash */
  }
}

/**
 * Get recent log entries from the ring buffer.
 * @param lines max entries
 * @param minLevel minimum log level to include (default 30 = info)
 */
export function getLogs(lines = 200, minLevel = 30): LogEntry[] {
  return ring.filter((e) => e.level >= minLevel).slice(-lines);
}

/**
 * Clear the log file on disk and the ring buffer.
 */
export function clearLogs(): void {
  ring.length = 0;
  try {
    ensureDir();
    fs.writeFileSync(LOG_FILE, '');
  } catch {
    /* best effort */
  }
}

/**
 * Read raw log file content (for download).
 */
export function readLogFile(): string {
  try {
    if (!fs.existsSync(LOG_FILE)) return '';
    return fs.readFileSync(LOG_FILE, 'utf-8');
  } catch {
    return '';
  }
}
