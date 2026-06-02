import type { FastifyInstance } from 'fastify';
import type { CORSRule } from '@aws-sdk/client-s3';
import { getLiveCorsConfig, applyLiveCorsConfig, DEFAULT_CORS_RULES } from '../../services/storage/b2/cors-service.js';
import { getSetting, upsertSetting } from '../../repositories/settings-repository.js';
import { recordAction } from '../../services/action-log-service.js';
import { getStorageBackend } from '../../config/index.js';

const CORS_RATE_LIMIT = 30;
const CORS_RATE_WINDOW_MS = 60_000;
const DB_KEY = 'b2_cors_settings';

/** Ensure the active storage backend is B2 before allowing CORS operations */
async function requireB2Backend(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const backend = await getStorageBackend();
  if (backend !== 'b2') {
    return {
      ok: false,
      status: 400,
      error: `CORS management is only available when B2 Storage is active. Current backend: ${backend}`,
    };
  }
  return { ok: true };
}

/** Map known errors to appropriate HTTP status codes */
function mapCorsError(err: Error): { status: number; message: string } {
  const msg = err.message;
  if (msg.includes('credentials not configured') || msg.includes('key_id')) {
    return { status: 400, message: 'B2 credentials not configured. Set key_id and app_key in Storage Configuration first.' };
  }
  if (msg.includes('InvalidAccessKeyId') || msg.includes('SignatureDoesNotMatch')) {
    return { status: 400, message: 'B2 authentication failed. Check your key_id and app_key.' };
  }
  if (msg.includes('NoSuchBucket') || msg.includes('not found')) {
    return { status: 400, message: 'B2 bucket not found. Check the bucket name in Storage Configuration.' };
  }
  if (msg.includes('AccessDenied') || msg.includes('Forbidden')) {
    return { status: 403, message: 'B2 access denied. The configured key may not have permission to manage CORS.' };
  }
  return { status: 502, message: `B2 API error: ${msg}` };
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
   * Fetch the live CORS config from B2, save it to DB, and return it.
   */
  app.get(
    '/admin/storage/cors',
    {
      config: {
        rateLimit: { max: CORS_RATE_LIMIT, timeWindow: CORS_RATE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const backendCheck = await requireB2Backend();
      if (!backendCheck.ok) {
        return reply.code(backendCheck.status).send({ error: backendCheck.error });
      }

      try {
        const liveRules = await getLiveCorsConfig();

        if (liveRules) {
          // Persist fetched config to DB as the source of truth
          await upsertSetting(DB_KEY, JSON.stringify(liveRules));

          if (request.user?.username) {
            await recordAction(
              request.user.username,
              'cors-fetch',
              'Fetched B2 CORS configuration from live bucket'
            );
          }

          return reply.send({ rules: liveRules, source: 'live' });
        }

        // No CORS configured on bucket — fall back to DB or defaults
        const stored = await getSetting(DB_KEY);
        if (stored) {
          return reply.send({ rules: JSON.parse(stored), source: 'db-fallback' });
        }

        return reply.send({ rules: DEFAULT_CORS_RULES, source: 'default' });
      } catch (err) {
        const { status, message } = mapCorsError(err as Error);
        return reply.code(status).send({ error: `Failed to fetch CORS config: ${message}` });
      }
    }
  );

  /**
   * PUT /admin/storage/cors
   * Validate and apply CORS configuration to the B2 bucket.
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
      const backendCheck = await requireB2Backend();
      if (!backendCheck.ok) {
        return reply.code(backendCheck.status).send({ error: backendCheck.error });
      }

      const body = request.body as { rules?: unknown };

      if (!body?.rules) {
        return reply.code(400).send({ error: 'Missing "rules" field in request body' });
      }

      const validation = validateCorsRules(body.rules);
      if (!validation.ok) {
        return reply.code(400).send({ error: validation.error });
      }

      try {
        await applyLiveCorsConfig(validation.rules);

        // Persist to DB as source of truth
        await upsertSetting(DB_KEY, JSON.stringify(validation.rules));

        if (request.user?.username) {
          await recordAction(
            request.user.username,
            'cors-update',
            `Applied B2 CORS configuration (${validation.rules.length} rule(s))`
          );
        }

        return reply.send({ ok: true, rules: validation.rules });
      } catch (err) {
        const { status, message } = mapCorsError(err as Error);
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
