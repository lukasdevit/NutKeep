import type { FastifyInstance } from 'fastify';
import { recordAction } from '../../services/action-log-service.js';
import { sendError, backupNoFileError, mapUploadError } from '../../errors/index.js';
import {
  listBackupFiles,
  uploadBackupFile,
  deleteBackupFile,
  restoreBackupFile,
} from '../../services/backup/backup-manage-service.js';

export async function adminBackupManageRoutes(app: FastifyInstance) {
  app.get('/admin/backup/list', async (_request, reply) => {
    try {
      const backups = listBackupFiles();
      return reply.send({ backups });
    } catch {
      return reply.send({ backups: [] });
    }
  });

  app.post('/admin/backup/upload', async (request, reply) => {
    const file = await request.file();
    if (!file) return sendError(reply, backupNoFileError());
    try {
      const backup = await uploadBackupFile(file.file, file.filename, request.user?.username);
      return reply.send({ ok: true, backup });
    } catch (err) {
      return sendError(reply, mapUploadError(err as Error));
    }
  });

  app.delete('/admin/backup/delete', {
    schema: { body: { type: 'object' as const, required: ['filename'], properties: { filename: { type: 'string' } } } },
  }, async (request, reply) => {
    const { filename } = request.body as { filename: string };
    try {
      deleteBackupFile(filename);
      if (request.user?.username) {
        await recordAction(request.user!.username, 'backup-delete', `Deleted backup: ${filename}`, { filename });
      }
      return reply.send({ ok: true });
    } catch (err) {
      return sendError(reply, mapUploadError(err as Error));
    }
  });

  app.post('/admin/backup/restore', {
    schema: { body: { type: 'object' as const, required: ['filename', 'confirm'], properties: { filename: { type: 'string' }, confirm: { type: 'string' } } } },
  }, async (request, reply) => {
    const { filename, confirm } = request.body as { filename: string; confirm: string };
    try {
      await restoreBackupFile(filename, confirm, request.user?.username);
      return reply.send({ ok: true, restored: filename, message: 'Database restored successfully. The server may need a restart for in-memory caches to refresh.' });
    } catch (err) {
      return sendError(reply, mapUploadError(err as Error));
    }
  });
}
