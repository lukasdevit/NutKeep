import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';

import { backupDatabase } from '../../db/index.js';
import { resolveProvider } from '../../services/storage/index.js';
import type { StorageProvider } from '../../services/storage/types.js';
import { getStorageBackend, clearConfigCache, getBackupRetentionDays } from '../../config/index.js';
import { recordAction } from '../../services/action-log-service.js';
import { getSetting, upsertSetting } from '../../repositories/settings-repository.js';
import { sendError, backupNotFoundError } from '../../errors/index.js';
import { listBackupHistory } from '../../repositories/backup-repository.js';

export async function adminBackupRoutes(app: FastifyInstance) {
  app.post('/admin/backup/run', async (request, reply) => {
    const backend = await getStorageBackend();
    const retentionDays = await getBackupRetentionDays();
    const destinations: { provider: StorageProvider; keyPrefix?: string; label?: string; retentionDays?: number }[] = [
      {
        provider: resolveProvider(backend),
        keyPrefix: 'backups',
        label: backend,
        retentionDays,
      },
    ];

    const result = await backupDatabase(app.log, ...destinations);
    if (request.user?.username) {
      await recordAction(
        request.user!.username,
        'backup-run',
        'Manual backup triggered',
        { ok: result.ok, results: result.results }
      );
    }
    return reply.send({ ok: result.ok, results: result.results });
  });

  app.get('/admin/backup/latest', async (_request, reply) => {
    try {
      const files = fs
        .readdirSync(path.join(process.cwd(), 'uploads', 'backups'))
        .filter((f) => f.startsWith('database-') && f.endsWith('.db'))
        .sort()
        .reverse();

      if (files.length === 0) {
        return sendError(reply, backupNotFoundError());
      }

      const latest = files[0]!;
      const filepath = path.join(process.cwd(), 'uploads', 'backups', latest);

      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${latest}"`);
      return reply.send(fs.createReadStream(filepath));
    } catch {
      return sendError(reply, backupNotFoundError());
    }
  });

  app.get('/admin/backup/history', async (_request, reply) => {
    const backups = await listBackupHistory();
    return reply.send({ backups });
  });

  app.get('/admin/backup/schedule', async (_request, reply) => {
    const value = await getSetting('backup_schedule_hours');
    const hours = parseInt(value || '6', 10) || 6;
    return reply.send({ backup_schedule_hours: hours });
  });

  app.patch('/admin/backup/schedule', async (request, reply) => {
    const { backup_schedule_hours } = request.body as {
      backup_schedule_hours?: number;
    };
    if (
      typeof backup_schedule_hours !== 'number' ||
      backup_schedule_hours < 1 ||
      backup_schedule_hours > 168
    ) {
      return reply
        .code(400)
        .send({ error: 'backup_schedule_hours must be a number between 1 and 168' });
    }
    await upsertSetting('backup_schedule_hours', String(backup_schedule_hours));
    clearConfigCache();
    if (request.user?.username) {
      await recordAction(
        request.user!.username,
        'backup-schedule',
        `Updated backup schedule to ${backup_schedule_hours}h`,
        { backup_schedule_hours }
      );
    }
    return reply.send({ ok: true, backup_schedule_hours });
  });
}
