import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middleware/index.js';
import { handleUpload } from '../../services/files/index.js';
import { writeLog } from '../../services/log-service.js';

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/upload', { preHandler: [requireAuth] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'No file was uploaded' });

    const user = request.user!;

    writeLog({
      time: new Date().toISOString(),
      level: 20,
      levelName: 'debug',
      category: 'debug',
      msg: `Upload started: ${file.filename}`,
      user: user.username,
      method: 'POST',
      url: '/upload',
      reqId: request.id,
      body: { filename: file.filename, mimetype: file.mimetype },
    });

    // Demo users: cap expiry
    let expiresInDays: number | undefined;
    if (!user.isDemo) {
      const expiryHeader = request.headers['x-file-expires'] as
        | string
        | undefined;
      const expiryQuery = (request.query as Record<string, string | undefined>)
        ?.expires;
      const raw = expiryHeader || expiryQuery;
      if (raw) {
        const days = parseInt(raw, 10);
        if (!isNaN(days) && days >= 1 && days <= 365) {
          expiresInDays = days;
        }
      }
    }

    try {
      const result = await handleUpload(file, user.id, expiresInDays);
      writeLog({
        time: new Date().toISOString(),
        level: 20,
        levelName: 'debug',
        category: 'debug',
        msg: `Upload complete: ${file.filename}`,
        user: user.username,
        method: 'POST',
        url: '/upload',
        statusCode: 200,
        reqId: request.id,
        body: {
          filename: file.filename,
          mimetype: file.mimetype,
          url: result.url,
          expiresInDays: expiresInDays ?? 'never',
        },
      });
      return reply.send(result);
    } catch (err) {
      const e = err as { statusCode?: number; message: string };
      return reply.code(e.statusCode || 500).send({ error: e.message });
    }
  });
}
