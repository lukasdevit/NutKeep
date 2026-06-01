import type { FastifyInstance } from 'fastify';
import {
  getLogs,
  clearLogs,
  readLogFile,
  writeLog,
} from '../../services/log-service.js';
import { recordAction } from '../../services/action-log-service.js';

export async function adminLogRoutes(app: FastifyInstance) {
  app.get('/admin/logs', async (request, reply) => {
    const { lines, level } = request.query as {
      lines?: string;
      level?: string;
    };
    const parsedLines = Math.min(
      Math.max(parseInt(lines || '200', 10) || 200, 1),
      2000
    );
    const parsedLevel = Math.min(
      Math.max(parseInt(level || '30', 10) || 30, 10),
      60
    );

    const entries = getLogs(parsedLines, parsedLevel);
    return reply.send({ logs: entries, total: entries.length });
  });

  app.get('/admin/logs/download', async (_request, reply) => {
    const content = readLogFile();
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', 'attachment; filename=nutkeep-app.log');
    return reply.send(content);
  });

  app.delete('/admin/logs', async (request, reply) => {
    clearLogs();
    if (request.user?.username) {
      await recordAction(
        request.user!.username,
        'logs-clear',
        'Cleared server logs'
      );
    }
    writeLog({
      time: new Date().toISOString(),
      level: 30,
      levelName: 'info',
      msg: `Logs cleared by admin${request.user ? ` (${request.user.username})` : ''}`,
    });
    return reply.send({ ok: true });
  });
}
