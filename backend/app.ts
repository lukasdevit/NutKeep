import { Writable } from 'stream';
import pino, { type StreamEntry } from 'pino';

import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  LOG_PRETTY,
  CORS_ORIGIN,
  DEFAULT_STORAGE_LIMIT,
} from './config/index.js';
import { uploadRoutes, multipartUploadRoutes, localChunkedRoutes } from './routes/upload/index.js';
import { filesRoutes } from './routes/files.js';
import { sharexRoutes } from './routes/sharex.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { writeLog } from './services/log-service.js';

const startTime = Date.now();

export interface AppOptions {
  logger?: boolean;
}

/** Writable stream that pipes pino JSON lines into the admin log ring buffer. */
function createAdminLogStream(): Writable {
  return new Writable({
    write(chunk: unknown, _encoding, callback) {
      try {
        const entry = JSON.parse(
          typeof chunk === 'string' ? chunk : (chunk as Buffer).toString()
        ) as Record<string, unknown>;
        const level = (entry.level as number) ?? 30;
        const LEVEL_LABELS: Record<number, string> = {
          10: 'trace', 20: 'debug', 30: 'info',
          40: 'warn', 50: 'error', 60: 'fatal',
        };
        writeLog({
          time: (entry.time as string) || new Date().toISOString(),
          level,
          levelName: LEVEL_LABELS[level] || 'info',
          category: 'debug',
          msg: (entry.msg as string) || '',
          err: entry.err,
        });
      } catch {
        /* malformed JSON line — skip */
      }
      callback();
    },
  });
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({ logger: opts.logger ? {} : false });

  if (opts.logger) {
    const streams: StreamEntry[] = [
      { stream: createAdminLogStream() },
    ];
    if (LOG_PRETTY) {
      streams.unshift({
        stream: pino.transport({
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        }),
      });
    } else {
      streams.unshift({ stream: process.stdout as any });
    }
    app.log = pino({}, pino.multistream(streams));
  }

  // Global ceiling = max per-user quota (10 GB). Actual per-user limits
  // are enforced in saveFile() by checking storage quota at upload time.
  await app.register(multipart, {
    limits: { fileSize: DEFAULT_STORAGE_LIMIT },
  });

  // Accept raw binary body for S3 part-proxy route
  app.addContentTypeParser('*', (_req, payload, done) => {
    const chunks: Buffer[] = [];
    payload.on('data', (chunk: Buffer) => chunks.push(chunk));
    payload.on('end', () => done(null, Buffer.concat(chunks)));
    payload.on('error', (err: Error) => done(err));
  });

  await app.register(rateLimit, {
    max: RATE_LIMIT_MAX,
    timeWindow: RATE_LIMIT_WINDOW_MS,
  });

  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'blob:'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
  });

  await app.register(cors, {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global error handler — catches schema validation + unhandled errors
  app.setErrorHandler((err, _request, reply) => {
    const error = err as {
      validation?: unknown;
      statusCode?: number;
      message?: string;
    };
    if (error.validation) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
      });
    }
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      writeLog({
        time: new Date().toISOString(),
        level: 50,
        levelName: 'error',
        category: 'debug',
        msg: error.message ?? 'Unknown error',
        err: error,
      });
    }
    return reply
      .code(statusCode)
      .send({ error: error.message ?? 'Internal server error' });
  });

  // Capture request/response logs for admin log viewer
  app.addHook('onRequest', async (request) => {
    (request as unknown as Record<string, unknown>)._logStart = Date.now();
  });
  app.addHook('onResponse', async (request, reply) => {
    // Don't log the log-viewer polling itself
    if (request.url.startsWith('/admin/logs')) return;

    const start = (request as unknown as Record<string, unknown>)
      ._logStart as number;
    const responseTime = start ? Date.now() - start : undefined;

    // Skip health checks entirely
    if (request.url === '/health') return;

    // GET/HEAD/OPTIONS -> trace level (hidden by default in admin panel)
    // POST/PUT/PATCH/DELETE -> info level (visible)
    const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);
    const level = isWrite
      ? reply.statusCode >= 400 ? 40 : 30
      : 10;
    const levelName = isWrite
      ? reply.statusCode >= 400 ? 'warn' : 'info'
      : 'trace';

    // Build a descriptive message that includes what was changed
    let msg = isWrite ? 'request completed' : `${request.method} ${request.url}`;
    let body: unknown = undefined;
    if (isWrite && request.body) {
      body = redactSensitive(request.body, request.url);
      const summary = summarizeAction(request.method, request.url, request.body);
      if (summary) msg = summary;
    }

    writeLog({
      time: new Date().toISOString(),
      level,
      levelName,
      category: 'debug',
      msg,
      reqId: request.id,
      user: request.user?.username,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
      body,
    });
  });

  await app.register(uploadRoutes);
  await app.register(multipartUploadRoutes);
  await app.register(localChunkedRoutes);
  await app.register(filesRoutes);
  await app.register(sharexRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);

  app.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

/** Strip password/secret fields from logged bodies. */
function redactSensitive(body: unknown, _url: string): unknown {
  if (typeof body !== 'object' || body === null) return body;
  const clone = { ...body as Record<string, unknown> };
  const sensitive = ['password', 'new_password', 'currentPassword', 'newPassword',
    'key', 'cert', 'app_key', 'key_id', 'token'];
  for (const key of sensitive) {
    if (key in clone) clone[key] = '***';
  }
  return clone;
}

/** Format key=value pairs, truncating long values. */
function formatChanges(body: Record<string, unknown>): string {
  return Object.entries(body)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => {
      const str = String(v);
      return `${k}=${str.length > 60 ? str.slice(0, 57) + '...' : str}`;
    })
    .join(', ');
}

/** Build a human-readable summary of what changed. */
function summarizeAction(method: string, url: string, body: unknown): string | null {
  const b = body as Record<string, unknown> | undefined;
  if (!b) return null;

  if (url.startsWith('/admin/storage') && method === 'PATCH') {
    const changes = formatChanges(b);
    return changes ? `storage config updated: ${changes}` : null;
  }
  if (url.startsWith('/admin/users') && method === 'PATCH') {
    const filtered = Object.fromEntries(
      Object.entries(b).filter(([, v]) => v !== undefined)
    );
    const changes = formatChanges(filtered);
    return changes ? `user edited: ${changes}` : null;
  }
  if (url.startsWith('/admin/users') && method === 'POST' && !url.includes('unlock')) {
    return `user created: ${b.username || 'unknown'}`;
  }
  if (url.startsWith('/admin/users') && method === 'DELETE') {
    return `user deleted: id=${url.split('/').pop()}`;
  }
  if (url.startsWith('/admin/users') && method === 'POST' && url.includes('unlock')) {
    return `user unlocked: id=${url.split('/').pop()}`;
  }
  if (url.startsWith('/admin/backup') && method === 'POST') {
    return url.includes('restore')
      ? `backup restored: ${b.filename || url.split('/').pop()}`
      : 'backup triggered';
  }
  if (url.startsWith('/admin/backup') && method === 'DELETE') {
    return `backup deleted: ${b.filename || 'unknown'}`;
  }
  if (url.startsWith('/admin/backup/schedule') && method === 'PATCH') {
    return `backup schedule: every ${b.backup_schedule_hours}h`;
  }
  if (url.startsWith('/auth/change-password')) {
    return 'password changed';
  }
  if (url.startsWith('/admin/users/demo-config') && method === 'PATCH') {
    return `demo registrations: ${b.demo_registrations_open ? 'enabled' : 'disabled'}`;
  }
  if (url.startsWith('/file/') && method === 'PATCH') {
    return `file toggled public: ${b.is_public ? 'yes' : 'no'}`;
  }
  if (url.startsWith('/file/') && method === 'DELETE') {
    return 'file deleted';
  }
  if (url.startsWith('/upload') && method === 'POST') {
    return 'file uploaded';
  }
  return null;
}
