import type { FastifyInstance } from 'fastify';
import { recordAction } from '../../services/action-log-service.js';
import { sendError, dbInvalidTableError, dbLastAdminError } from '../../errors/index.js';
import {
  isValidTable,
  listTables,
  browseTable,
  isAdminUser,
  countAdmins,
  findRow,
  deleteRow,
} from '../../repositories/db-repository.js';

export async function adminDbRoutes(app: FastifyInstance) {
  app.get('/admin/db/tables', async (_request, reply) => {
    const results = await listTables();
    return reply.send(results);
  });

  app.get('/admin/db/tables/:name/rows', async (request, reply) => {
    const { name } = request.params as { name: string };
    if (!isValidTable(name)) {
      return sendError(reply, dbInvalidTableError());
    }
    const data = await browseTable(name);
    return reply.send(data);
  });

  app.delete(
    '/admin/db/tables/:name/rows',
    {
      schema: {
        body: {
          type: 'object' as const,
          required: ['pkColumn', 'pkValue'],
          properties: { pkColumn: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { name } = request.params as { name: string };
      if (!isValidTable(name)) {
        return sendError(reply, dbInvalidTableError());
      }

      const { pkColumn, pkValue } = request.body as {
        pkColumn: string;
        pkValue: unknown;
      };

      // Prevent deleting the last admin
      if (name === 'users') {
        const isAdmin = await isAdminUser(pkColumn, pkValue);
        if (isAdmin && (await countAdmins()) <= 1) {
          return sendError(reply, dbLastAdminError());
        }
      }

      const row = await findRow(name, pkColumn, pkValue);
      const changes = await deleteRow(name, pkColumn, pkValue);

      if (request.user?.username && row) {
        await recordAction(
          request.user!.username,
          'db-delete',
          `Deleted from ${name} where ${pkColumn}=${pkValue}`,
          { table: name, pkColumn, pkValue, row }
        );
      }
      return reply.send({ ok: true, changes });
    }
  );
}
