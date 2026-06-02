import fs from 'fs';
import path from 'path';
import { DEFAULT_UPLOAD_DIR } from '../config/index.js';

const LOG_DIR = path.join(DEFAULT_UPLOAD_DIR, 'logs');
const RING_SIZE = 2000;
const MAX_DISK_LINES = 10_000; // max lines per category file before trimming

export type LogCategory = 'audit' | 'security' | 'debug' | 'general';

export const LOG_CATEGORIES: LogCategory[] = ['audit', 'security', 'debug', 'general'];

const CATEGORY_FILES: Record<LogCategory, string> = {
  audit: path.join(LOG_DIR, 'audit.log'),
  security: path.join(LOG_DIR, 'security.log'),
  debug: path.join(LOG_DIR, 'debug.log'),
  general: path.join(LOG_DIR, 'app.log'),
};

interface LogEntry {
  time: string;
  level: number;
  levelName: string;
  msg: string;
  category: LogCategory;
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

// Per-category line counters for disk trimming (reset on restart — acceptable)
const diskLineCount: Record<string, number> = {};

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
  let line = `${entry.time} [${level}] [${entry.category}] ${entry.msg}`;
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
 * Trim a log file to the most recent KEEP_LINES when it exceeds MAX_DISK_LINES.
 * Reads the file, keeps the last half, rewrites. Best-effort, non-blocking.
 */
function trimLogFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.length > 0);
    if (lines.length <= MAX_DISK_LINES) return;
    const keep = lines.slice(-Math.floor(MAX_DISK_LINES / 2));
    fs.writeFileSync(filePath, keep.join('\n') + '\n');
  } catch {
    /* best effort — don't crash on trim failure */
  }
}

/**
 * Write a log entry to the ring buffer and disk.
 * Call this from a pino transport or from Fastify hooks.
 *
 * @param entry — must include a `category` field.
 *   Use 'security' for auth events, 'audit' for admin actions,
 *   'debug' for request/response and technical logs, 'general' for everything else.
 */
export function writeLog(entry: LogEntry): void {
  // Ensure category is set (default for backward compat)
  if (!entry.category) entry.category = 'general';

  // Ring buffer
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();

  // Disk — write to category-specific file (best-effort, non-blocking)
  try {
    ensureDir();
    const filePath = CATEGORY_FILES[entry.category] || CATEGORY_FILES.general;
    fs.appendFileSync(filePath, formatLogLine(entry) + '\n');

    // Trim file when it exceeds max lines (checked every ~100 writes per category)
    const count = (diskLineCount[entry.category] || 0) + 1;
    diskLineCount[entry.category] = count;
    if (count % 100 === 0) {
      trimLogFile(filePath);
    }
  } catch {
    /* log write failure shouldn't crash */
  }
}

/**
 * Get recent log entries from the ring buffer.
 * @param lines max entries
 * @param minLevel minimum log level to include (default 30 = info)
 * @param category optional category filter — returns all categories when omitted
 */
export function getLogs(
  lines = 200,
  minLevel = 30,
  category?: LogCategory
): LogEntry[] {
  let filtered = ring.filter((e) => e.level >= minLevel);
  if (category) {
    filtered = filtered.filter((e) => e.category === category);
  }
  return filtered.slice(-lines);
}

/**
 * Clear all log files on disk and the ring buffer.
 */
export function clearLogs(): void {
  ring.length = 0;
  try {
    ensureDir();
    for (const filePath of Object.values(CATEGORY_FILES)) {
      fs.writeFileSync(filePath, '');
    }
  } catch {
    /* best effort */
  }
}

/**
 * Read raw log file content for a specific category (for download).
 * Returns all log files concatenated when category is omitted.
 */
export function readLogFile(category?: LogCategory): string {
  try {
    if (!fs.existsSync(LOG_DIR)) return '';
    if (category) {
      const filePath = CATEGORY_FILES[category];
      return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    }
    // Concatenate all category files
    let all = '';
    for (const cat of LOG_CATEGORIES) {
      const filePath = CATEGORY_FILES[cat];
      if (fs.existsSync(filePath)) {
        all += fs.readFileSync(filePath, 'utf-8');
      }
    }
    return all;
  } catch {
    return '';
  }
}
