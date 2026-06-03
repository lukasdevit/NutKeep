import type { FastifyInstance } from 'fastify';
import {
  getLogs,
  clearLogs,
  readLogFile,
  writeLog,
  LOG_CATEGORIES,
  type LogCategory,
} from '../../services/log-service.js';
import { recordAction } from '../../services/action-log-service.js';

function parseCategory(raw: string | undefined): LogCategory | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if ((LOG_CATEGORIES as string[]).includes(lower)) {
    return lower as LogCategory;
  }
  return undefined;
}

export async function adminLogRoutes(app: FastifyInstance) {
  app.get('/admin/logs', async (request, reply) => {
    const { lines, level, category } = request.query as {
      lines?: string;
      level?: string;
      category?: string;
    };
    const parsedLines = Math.min(
      Math.max(parseInt(lines || '200', 10) || 200, 1),
      2000
    );
    const parsedLevel = Math.min(
      Math.max(parseInt(level || '30', 10) || 30, 10),
      60
    );
    const cat = parseCategory(category);

    const entries = getLogs(parsedLines, parsedLevel, cat);
    return reply.send({ logs: entries, total: entries.length });
  });

  app.get('/admin/logs/download', async (request, reply) => {
    const { category } = request.query as { category?: string };
    const cat = parseCategory(category);
    const content = readLogFile(cat);
    const filename = cat ? `linqoy-${cat}.log` : 'linqoy-all.log';
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename=${filename}`);
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
      category: 'audit',
      msg: `Logs cleared by admin${request.user ? ` (${request.user.username})` : ''}`,
    });
    return reply.send({ ok: true });
  });
}
