import type { FastifyInstance } from 'fastify';
import type { CORSRule, S3Client } from '@aws-sdk/client-s3';
import { getLiveCorsConfig, applyLiveCorsConfig, DEFAULT_CORS_RULES } from '../../services/storage/b2/cors-service.js';
import { getSetting, upsertSetting } from '../../repositories/settings-repository.js';
import { recordAction } from '../../services/action-log-service.js';
import { getStorageBackend } from '../../config/index.js';

const CORS_RATE_LIMIT = 30;
const CORS_RATE_WINDOW_MS = 60_000;

/** CORS is supported for S3-compatible backends (B2, R2, etc.) */
const S3_BACKENDS = new Set(['b2', 'r2']);

export function isCorsSupported(backend: string): boolean {
  return S3_BACKENDS.has(backend);
}

function dbKey(backend: string): string {
  return `${backend}_cors_settings`;
}

/** Resolve S3 client + bucket for the active backend */
async function resolveS3Backend(): Promise<{ ok: true; s3: S3Client; bucket: string; backend: string } | { ok: false; status: number; error: string }> {
  const backend = await getStorageBackend();
  if (!S3_BACKENDS.has(backend)) {
    return {
      ok: false,
      status: 400,
      error: `CORS management is only available for S3-compatible storage (b2, r2). Current backend: ${backend}`,
    };
  }
  const { getS3Client, getBucket } = await import(`../../services/storage/${backend}/client.js`);
  const [s3, bucket] = await Promise.all([getS3Client(), getBucket()]);
  return { ok: true, s3, bucket, backend };
}

/** Map known errors to appropriate HTTP status codes */
function mapCorsError(err: Error, backend: string): { status: number; message: string } {
  const msg = err.message;
  const label = backend.toUpperCase();
  if (msg.includes('credentials not configured') || msg.includes('key_id') || msg.includes('access_key')) {
    return { status: 400, message: `${label} credentials not configured. Check Storage Configuration.` };
  }
  if (msg.includes('InvalidAccessKeyId') || msg.includes('SignatureDoesNotMatch')) {
    return { status: 400, message: `${label} authentication failed. Check your credentials.` };
  }
  if (msg.includes('NoSuchBucket') || msg.includes('not found')) {
    return { status: 400, message: `${label} bucket not found. Check the bucket name in Storage Configuration.` };
  }
  if (msg.includes('AccessDenied') || msg.includes('Forbidden')) {
    return { status: 403, message: `${label} access denied. The configured key may not have permission to manage CORS.` };
  }
  if (msg.includes('B2 Native CORS') || msg.includes('B2 Native API')) {
    return { status: 400, message: 'B2 bucket uses Native CORS rules. In the B2 console, go to bucket settings → CORS Rules → switch to "S3 Compatible API" or "Both".' };
  }
  if (msg.includes('unsupported http method') || msg.includes('Unsupported method')) {
    return { status: 400, message: 'CORS rules contain an unsupported HTTP method (e.g. OPTIONS). Remove it — OPTIONS is handled automatically by CORS.' };
  }
  return { status: 502, message: `${label} API error: ${msg}` };
}

/** Validate that the input is a valid CORSRule array */
function validateCorsRules(input: unknown): { ok: true; rules: CORSRule[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'CORS configuration must be a JSON array of rules' };
  }

  for (let i = 0; i < input.length; i++) {
    const rule = input[i] as Record<string, unknown> | null;
    if (!rule || typeof rule !== 'object') {
      return { ok: false, error: `Rule at index ${i} must be an object` };
    }
    const methods = rule.AllowedMethods;
    const origins = rule.AllowedOrigins;
    if (!Array.isArray(methods) || methods.length === 0) {
      return { ok: false, error: `Rule at index ${i}: AllowedMethods is required and must be a non-empty array` };
    }
    if (!Array.isArray(origins) || origins.length === 0) {
      return { ok: false, error: `Rule at index ${i}: AllowedOrigins is required and must be a non-empty array` };
    }
  }

  return { ok: true, rules: input as CORSRule[] };
}

export async function adminCorsRoutes(app: FastifyInstance) {
  /**
   * GET /admin/storage/cors
   * Fetch the live CORS config from the bucket, save it to DB, and return it.
   */
  app.get(
    '/admin/storage/cors',
    {
      config: {
        rateLimit: { max: CORS_RATE_LIMIT, timeWindow: CORS_RATE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const resolved = await resolveS3Backend();
      if (!resolved.ok) {
        return reply.code(resolved.status).send({ error: resolved.error });
      }
      const { s3, bucket, backend } = resolved;
      const key = dbKey(backend);

      try {
        const liveRules = await getLiveCorsConfig(s3, bucket);

        if (liveRules) {
          await upsertSetting(key, JSON.stringify(liveRules));

          if (request.user?.username) {
            await recordAction(
              request.user.username,
              'cors-fetch',
              `Fetched ${backend.toUpperCase()} CORS configuration from live bucket`
            );
          }

          return reply.send({ rules: liveRules, source: 'live' });
        }

        const stored = await getSetting(key);
        if (stored) {
          return reply.send({ rules: JSON.parse(stored), source: 'db-fallback' });
        }

        return reply.send({ rules: DEFAULT_CORS_RULES, source: 'default' });
      } catch (err) {
        request.log.error({ err }, 'CORS fetch failed');
        const { status, message } = mapCorsError(err as Error, backend);
        return reply.code(status).send({ error: `Failed to fetch CORS config: ${message}` });
      }
    }
  );

  /**
   * PUT /admin/storage/cors
   * Validate and apply CORS configuration to the bucket.
   * Body: { rules: CORSRules }
   */
  app.put(
    '/admin/storage/cors',
    {
      config: {
        rateLimit: { max: CORS_RATE_LIMIT, timeWindow: CORS_RATE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const resolved = await resolveS3Backend();
      if (!resolved.ok) {
        return reply.code(resolved.status).send({ error: resolved.error });
      }
      const { s3, bucket, backend } = resolved;
      const key = dbKey(backend);

      const body = request.body as { rules?: unknown };

      if (!body?.rules) {
        return reply.code(400).send({ error: 'Missing "rules" field in request body' });
      }

      const validation = validateCorsRules(body.rules);
      if (!validation.ok) {
        return reply.code(400).send({ error: validation.error });
      }

      try {
        await applyLiveCorsConfig(s3, bucket, validation.rules);

        await upsertSetting(key, JSON.stringify(validation.rules));

        if (request.user?.username) {
          await recordAction(
            request.user.username,
            'cors-update',
            `Applied ${backend.toUpperCase()} CORS configuration (${validation.rules.length} rule(s))`
          );
        }

        return reply.send({ ok: true, rules: validation.rules });
      } catch (err) {
        request.log.error({ err }, 'CORS apply failed');
        const { status, message } = mapCorsError(err as Error, backend);
        return reply.code(status).send({ error: `Failed to apply CORS config: ${message}` });
      }
    }
  );

  /**
   * GET /admin/storage/cors/default
   * Return the default safe CORS configuration.
   */
  app.get(
    '/admin/storage/cors/default',
    {
      config: {
        rateLimit: { max: CORS_RATE_LIMIT, timeWindow: CORS_RATE_WINDOW_MS },
      },
    },
    async (_request, reply) => {
      return reply.send({ rules: DEFAULT_CORS_RULES });
    }
  );
}
