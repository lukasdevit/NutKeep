import type { FastifyInstance } from 'fastify';
import type { CORSRule, S3Client } from '@aws-sdk/client-s3';
import { getLiveCorsConfig, applyLiveCorsConfig, DEFAULT_CORS_RULES } from '../../services/storage/b2/cors-service.js';
import { getSetting, upsertSetting } from '../../repositories/settings-repository.js';
import { recordAction } from '../../services/action-log-service.js';
import { getStorageBackend } from '../../config/index.js';
import { sendError, mapCorsError, createError, validationError } from '../../errors/index.js';

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
async function resolveS3Backend(): Promise<{ ok: true; s3: S3Client; bucket: string; backend: string } | { ok: false; error: ReturnType<typeof createError> }> {
  const backend = await getStorageBackend();
  if (!S3_BACKENDS.has(backend)) {
    return {
      ok: false,
      error: createError(
        'CORS_UNSUPPORTED_BACKEND',
        'cors.unsupported_backend',
        400,
        `CORS management is only available for S3-compatible storage (b2, r2). Current backend: ${backend}`,
      ),
    };
  }
  const { getS3Client, getBucket } = await import(`../../services/storage/${backend}/client.js`);
  const [s3, bucket] = await Promise.all([getS3Client(), getBucket()]);
  return { ok: true, s3, bucket, backend };
}

/** Map known errors to appropriate HTTP status codes */
// (moved to ../../errors/cors.errors.ts — re-exported via mapCorsError import)

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
      try {
        const resolved = await resolveS3Backend();
        if (!resolved.ok) {
          return sendError(reply, resolved.error);
        }
        const { s3, bucket, backend } = resolved;
        const key = dbKey(backend);

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
        let backend = 'b2';
        try { backend = await getStorageBackend(); } catch { /* keep default */ }
        const apiError = mapCorsError(err as Error, backend);
        return sendError(reply, apiError);
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
      try {
        const resolved = await resolveS3Backend();
        if (!resolved.ok) {
          return sendError(reply, resolved.error);
        }
        const { s3, bucket, backend } = resolved;
        const key = dbKey(backend);

        const body = request.body as { rules?: unknown };

        if (!body?.rules) {
          return sendError(reply, validationError('Missing "rules" field in request body'));
        }

        const validation = validateCorsRules(body.rules);
        if (!validation.ok) {
          return sendError(reply, validationError(validation.error));
        }

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
        let backend = 'b2';
        try { backend = await getStorageBackend(); } catch { /* keep default */ }
        const apiError = mapCorsError(err as Error, backend);
        return sendError(reply, apiError);
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
