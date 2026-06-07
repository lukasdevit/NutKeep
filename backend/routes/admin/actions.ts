import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { sendError, actionNotFoundError, mapFileError } from '../../errors/index.js';
import {
  listRecentActions,
  findActionById,
  markActionUndone,
  deleteUndoneActions,
} from '../../repositories/action-repository.js';
import { deleteById, reInsertFile, updateFilePathAndUser } from '../../repositories/file-repository.js';
import { deleteUser } from '../../repositories/user-repository.js';
import { reInsertRow } from '../../repositories/db-repository.js';

export async function adminActionsRoutes(app: FastifyInstance) {
  app.get('/admin/actions', async (_request, reply) => {
    const rows = await listRecentActions();
    return reply.send({
      actions: rows.map((r) => ({ ...r, undone: !!r.undone })),
    });
  });

  app.post('/admin/actions/:id/undo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const action = await findActionById(parseInt(id, 10));
    if (!action)
      return sendError(reply, actionNotFoundError());

    const data = action.undo_data ? JSON.parse(action.undo_data) : null;

    try {
      await performUndo(action.action, data);
      await markActionUndone(action.id);
      return reply.send({ ok: true, undone: action.action });
    } catch (err) {
      return sendError(reply, mapFileError(err as Error));
    }
  });

  app.delete('/admin/actions', async (_request, reply) => {
    const deleted = await deleteUndoneActions();
    return reply.send({ ok: true, deleted });
  });
}

async function performUndo(
  action: string,
  data: Record<string, unknown> | null
): Promise<void> {
  if (!data) throw new Error('No undo data available');

  switch (action) {
    case 'delete-db': {
      await reInsertFile(data);
      break;
    }
    case 'db-delete': {
      const { table, row } = data as { table: string; row: Record<string, unknown> };
      if (!table || !row) throw new Error('Missing table/row data for undo');
      await reInsertRow(table, row);
      break;
    }
    case 'user-create': {
      if (data.userId) await deleteUser(data.userId as number);
      break;
    }
    case 'import': {
      if (data.fileId) await deleteById(data.fileId as number);
      break;
    }
    case 'delete-file': {
      throw new Error('File deletion cannot be undone — file is permanently removed from disk');
    }
    case 'migrate': {
      if (data.fromPath && data.toPath) {
        const src = String(data.toPath);
        const dest = String(data.fromPath);
        if (!fs.existsSync(src))
          throw new Error('Migrated file no longer exists at destination');
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.renameSync(src, dest);
        await updateFilePathAndUser(String(data.toPath), String(data.fromPath), data.fromUserId as number);
      }
      break;
    }
    default:
      throw new Error(`Undo not supported for action: ${action}`);
  }
}
