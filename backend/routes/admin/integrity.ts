import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { DEFAULT_UPLOAD_DIR } from '../../config/index.js';
import { findIdByUsername } from '../../repositories/user-repository.js';
import { sendError, integrityCheckNotFoundError, integrityMissingParamError, integrityForbiddenError, fileNotFoundError } from '../../errors/index.js';
import {
  listChecks,
  findCheck,
  deleteCheck,
  countIssues,
  listIssues,
} from '../../repositories/integrity-repository.js';
import {
  runIntegrityCheck,
  resolveSingleIssue,
  importOrphanedFiles,
  migrateFile,
} from '../../services/files/integrity.js';
import { getMimeType } from '../../services/files/adapter.js';

export async function adminIntegrityRoutes(app: FastifyInstance) {
  app.get('/admin/storage/integrity', async (_request, reply) => {
    const checks = await listChecks();
    return reply.send({ checks });
  });

  app.post(
    '/admin/storage/integrity',
    {
      schema: {
        body: {
          type: 'object' as const,
          properties: {
            userId: { type: 'number' },
            username: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = (request.body || {}) as {
        userId?: number;
        username?: string;
      };
      let userId = body.userId;

      if (body.username && !userId) {
        const resolved = await findIdByUsername(body.username);
        if (resolved !== null) userId = resolved;
      }

      const result = await runIntegrityCheck(userId);
      return reply.send(result);
    }
  );

  app.get('/admin/storage/integrity/:checkId', async (request, reply) => {
    const { checkId } = request.params as { checkId: string };
    const { offset, limit, type, userId, username } = request.query as {
      offset?: string; limit?: string; type?: string;
      userId?: string; username?: string;
    };

    const check = await findCheck(checkId);
    if (!check) return sendError(reply, integrityCheckNotFoundError());

    const start = parseInt(offset || '0', 10) || 0;
    const count = Math.min(parseInt(limit || '50', 10) || 50, 200);

    const conditions: string[] = ['check_id = ?'];
    const params: (string | number)[] = [checkId];

    if (type && ['missing-file', 'orphaned-file', 'size-mismatch'].includes(type)) {
      conditions.push('type = ?');
      params.push(type);
    }

    let resolvedUserId: number | null = null;
    if (username) {
      const id = await findIdByUsername(username);
      resolvedUserId = id ?? -1;
    } else if (userId && !isNaN(parseInt(userId, 10))) {
      resolvedUserId = parseInt(userId, 10);
    }
    if (resolvedUserId !== null) {
      conditions.push('user_id = ?');
      params.push(resolvedUserId);
    }

    const where = conditions.join(' AND ');

    const [total, issues, unresolved] = await Promise.all([
      countIssues(where, params),
      listIssues(where, params, count, start),
      countIssues(`${where} AND resolved = 0`, params),
    ]);

    return reply.send({
      issues: issues.map((i) => ({ ...i, resolved: !!i.resolved })),
      offset: start,
      limit: count,
      total,
      unresolved,
    });
  });

  app.post(
    '/admin/storage/integrity/:checkId/resolve',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['issueId', 'action'],
          properties: {
            issueId: { type: 'number' },
            action: { type: 'string', enum: ['delete-db', 'delete-file', 'skip'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { checkId } = request.params as { checkId: string };
      const { issueId, action } = request.body as { issueId: number; action: string };
      await resolveSingleIssue(checkId, issueId, action, request.user?.username);
      return reply.send({ ok: true, issueId });
    }
  );


  app.post(
    '/admin/storage/integrity/:checkId/resolve-bulk',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['issueIds', 'action'],
          properties: {
            issueIds: { type: 'array', items: { type: 'number' } },
            action: { type: 'string', enum: ['delete-db', 'delete-file', 'skip'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { checkId } = request.params as { checkId: string };
      const { issueIds, action } = request.body as { issueIds: number[]; action: string };
      let resolved = 0;
      for (const id of issueIds) {
        try {
          await resolveSingleIssue(checkId, id, action, request.user?.username);
          resolved++;
        } catch { /* skip */ }
      }
      return reply.send({ ok: true, resolved });
    }
  );


  app.post(
    '/admin/storage/integrity/:checkId/import',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['issueIds'],
          properties: {
            issueIds: { type: 'array', items: { type: 'number' } },
            userId: { type: 'number' },
            originalName: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { checkId } = request.params as { checkId: string };
      const { issueIds, userId, originalName } = request.body as {
        issueIds: number[];
        userId?: number;
        originalName?: string;
      };
      const imported = await importOrphanedFiles(
        checkId, issueIds, request.user?.username, userId, originalName
      );
      return reply.send({ ok: true, imported });
    }
  );

  app.get('/admin/file-preview', async (request, reply) => {
    const { path: filePath } = request.query as { path?: string };
    if (!filePath) return sendError(reply, integrityMissingParamError('path'));

    const absPath = path.join(DEFAULT_UPLOAD_DIR, filePath);
    if (!absPath.startsWith(DEFAULT_UPLOAD_DIR)) return sendError(reply, integrityForbiddenError());
    if (!fs.existsSync(absPath)) return sendError(reply, fileNotFoundError(filePath));

    const mime = getMimeType(filePath);
    const stat = fs.statSync(absPath);
    reply.header('Content-Type', mime);
    reply.header('Content-Length', stat.size);
    reply.header('Cache-Control', 'no-cache');
    return reply.send(fs.createReadStream(absPath));
  });

  app.post(
    '/admin/storage/migrate',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['paths', 'toUserId'],
          properties: {
            paths: { type: 'array', items: { type: 'string' } },
            toUserId: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { paths: relPaths, toUserId } = request.body as {
        paths: string[];
        toUserId: number;
      };
      const migrated: string[] = [];
      const errors: string[] = [];

      for (const relPath of relPaths) {
        try {
          const result = await migrateFile(relPath, toUserId, request.user?.username);
          migrated.push(result);
        } catch (err) {
          errors.push(`${relPath}: ${(err as Error).message}`);
        }
      }

      return reply.send({ ok: errors.length === 0, migrated, errors });
    }
  );

  app.delete('/admin/storage/integrity/:checkId', async (request, reply) => {
    const { checkId } = request.params as { checkId: string };
    await deleteCheck(checkId);
    return reply.send({ ok: true });
  });
}
