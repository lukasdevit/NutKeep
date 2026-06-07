import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  requireAuth,
  getTokenFromHeader,
  verifyToken,
} from '../middleware/index.js';
import { parseRange } from '../utils/index.js';
import {
  resolveReadStream,
  resolveReadStreamRange,
} from '../services/files/file-stream.js';
import {
  getFileByFilename,
  getRandomFile,
  listUserFiles,
  toggleFilePublic,
  deleteUserFile,
} from '../services/files/file-listing-service.js';
import { sendError, mapFileError, filePrivateError } from '../errors/index.js';

const FILE_SERVE_RATE = 300;
const FILE_LIST_RATE = 120;
const FILE_RATE_WINDOW_MS = 60_000;

export async function filesRoutes(app: FastifyInstance) {
  app.get(
    '/file/:filename',
    {
      config: {
        rateLimit: { max: FILE_SERVE_RATE, timeWindow: FILE_RATE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const { filename } = request.params as { filename: string };

      try {
        const file = await getFileByFilename(filename);

        // If not public, require auth + ownership
        if (!file.is_public) {
          const token = getTokenFromHeader(request as FastifyRequest);
          const payload = token ? verifyToken(token) : null;
          if (!payload || payload.id !== file.user_id) {
            return sendError(reply, filePrivateError());
          }
        }

        const stream = await resolveReadStream(file.path, file.storage_backend);

        // Security: prevent inline rendering of active content (stored XSS mitigation)
        const ACTIVE_MIME_TYPES = new Set([
          'text/html',
          'image/svg+xml',
          'text/javascript',
          'application/javascript',
          'text/xml',
          'application/xml',
        ]);

        if (ACTIVE_MIME_TYPES.has(file.mime_type)) {
          reply.header('Content-Type', 'application/octet-stream');
          reply.header('Content-Disposition', 'attachment');
        } else {
          reply.header('Content-Type', file.mime_type);
        }

        reply.header('Accept-Ranges', 'bytes');

        // Public files → CDN/browser can cache aggressively
        // Private files (owner only) → zero cache, always revalidate
        if (file.is_public) {
          reply.header('Cache-Control', 'public, max-age=31536000');
        } else {
          reply.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        }

        reply.header('Access-Control-Allow-Origin', '*');

        // Handle HTTP Range requests (required for video/audio seeking)
        const rangeHeader = request.headers.range;
        if (rangeHeader) {
          const parsed = parseRange(rangeHeader, file.size);
          if (parsed) {
            const { start, end } = parsed;
            const rangeStream = await resolveReadStreamRange(
              file.path,
              file.storage_backend,
              start,
              end
            );
            reply
              .code(206)
              .header('Content-Range', `bytes ${start}-${end}/${file.size}`)
              .header('Content-Length', end - start + 1);
            return reply.send(rangeStream);
          }
        }

        reply.header('Content-Length', file.size);
        return reply.send(stream);
      } catch (err) {
        if (!reply.sent) {
          return sendError(reply, mapFileError(err as Error));
        }
      }
    }
  );

  app.get(
    '/files/random',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const type = (request.query as { type?: string }).type;
        const file = await getRandomFile(request.user!.id, type);
        return reply.send({ data: file });
      } catch (err) {
        return sendError(reply, mapFileError(err as Error));
      }
    }
  );

  app.get(
    '/files',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: { max: FILE_LIST_RATE, timeWindow: FILE_RATE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        search?: string;
        type?: string;
      };

      const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10) || 50));
      const search = query.search?.trim();
      const fileType = query.type?.trim();

      try {
        const result = await listUserFiles(request.user!.id, {
          page,
          limit,
          ...(search ? { search } : {}),
          ...(fileType ? { type: fileType } : {}),
        });
        return reply.send(result);
      } catch (err) {
        return sendError(reply, mapFileError(err as Error));
      }
    }
  );

  app.patch(
    '/file/:id',
    {
      preHandler: [requireAuth],
      schema: {
        body: {
          type: 'object' as const,
          required: ['is_public'],
          properties: { is_public: { type: 'boolean' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { is_public } = request.body as { is_public: boolean };

      try {
        const result = await toggleFilePublic(parseInt(id, 10), request.user!.id, is_public);
        return reply.send({ ok: true, ...result });
      } catch (err) {
        return sendError(reply, mapFileError(err as Error));
      }
    }
  );

  app.delete(
    '/file/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await deleteUserFile(parseInt(id, 10), request.user!.id);
        return reply.send({ ok: true });
      } catch (err) {
        return sendError(reply, mapFileError(err as Error));
      }
    }
  );
}
