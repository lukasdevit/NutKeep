import type { FastifyInstance } from 'fastify';
import type { CORSRule } from '@aws-sdk/client-s3';
import { getLiveCorsConfig, applyLiveCorsConfig, DEFAULT_CORS_RULES } from '../../services/storage/b2/cors-service.js';
import { getSetting, upsertSetting } from '../../repositories/settings-repository.js';
import { recordAction } from '../../services/action-log-service.js';

const CORS_RATE_LIMIT = 30;
const CORS_RATE_WINDOW_MS = 60_000;
const DB_KEY = 'b2_cors_settings';

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
        const msg = (err as Error).message;
        return reply.code(502).send({ error: `Failed to fetch CORS config: ${msg}` });
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
        const msg = (err as Error).message;
        return reply.code(502).send({ error: `Failed to apply CORS config: ${msg}` });
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
