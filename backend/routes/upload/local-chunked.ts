import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';

import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';

import { requireAuth } from '../../middleware/index.js';
import { BASE_URL } from '../../config/index.js';
import { saveFromPath } from '../../services/files/index.js';
import { writeLog } from '../../services/log-service.js';
import { prepareUploadInit } from './helpers.js';

const CHUNK_DIR = path.join(os.tmpdir(), 'linqoy-chunks');

// Default chunk size constant for documentation (actual chunking is frontend-side)
export const LOCAL_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

function chunkDir(uploadId: string): string {
  return path.join(CHUNK_DIR, uploadId);
}

function partPath(uploadId: string, partNumber: number): string {
  return path.join(chunkDir(uploadId), `part_${partNumber}`);
}

export async function localChunkedRoutes(app: FastifyInstance) {
  // Ensure chunk root directory exists
  await fsp.mkdir(CHUNK_DIR, { recursive: true });

  /**
   * POST /upload/local/init
   * Initiate a local chunked upload. Returns uploadId + pre-generated filename.
   */
  app.post(
    '/upload/local/init',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = request.body as {
        filename: string;
        mimeType: string;
        totalParts: number;
        totalSize: number;
        expiresInDays?: number;
      };

      if (!body.filename || !body.mimeType || !body.totalParts || !body.totalSize) {
        return reply.code(400).send({
          error: 'filename, mimeType, totalParts, and totalSize required',
        });
      }

      let originalName: string;
      let filename: string;
      try {
        const prep = await prepareUploadInit(
          { filename: body.filename, mimeType: body.mimeType, totalSize: body.totalSize },
          request.user!.id,
          request.user!.username
        );
        originalName = prep.originalName;
        filename = prep.filename;
      } catch (err) {
        const e = err as { statusCode?: number; message: string };
        return reply.code(e.statusCode || 500).send({ error: e.message });
      }

      const uploadId = nanoid(16);

      await fsp.mkdir(chunkDir(uploadId), { recursive: true });

      // Store metadata alongside chunks so /complete doesn't need to trust client
      await fsp.writeFile(
        path.join(chunkDir(uploadId), 'meta.json'),
        JSON.stringify({
          originalName,
          filename,
          mimeType: body.mimeType,
          totalParts: body.totalParts,
          totalSize: body.totalSize,
          expiresInDays: body.expiresInDays ?? null,
          userId: request.user!.id,
        })
      );

      writeLog({
        time: new Date().toISOString(),
        level: 20,
        levelName: 'debug',
        category: 'debug',
        msg: `Local chunked init: ${originalName} (${body.mimeType}) uploadId=${uploadId} parts=${body.totalParts}`,
        user: request.user!.username,
        method: 'POST',
        url: '/upload/local/init',
        reqId: request.id,
      });

      return reply.send({
        data: { uploadId, filename },
      });
    }
  );

  /**
   * POST /upload/local/part?uploadId=X&partNumber=N
   * Upload a single chunk. Body is raw binary (application/octet-stream).
   */
  app.post(
    '/upload/local/part',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { uploadId, partNumber } = request.query as {
        uploadId?: string;
        partNumber?: string;
      };

      if (!uploadId || !partNumber) {
        return reply.code(400).send({ error: 'uploadId and partNumber required' });
      }

      const partNum = parseInt(partNumber, 10);
      if (isNaN(partNum) || partNum < 1) {
        return reply.code(400).send({ error: 'partNumber must be a positive integer' });
      }

      const dir = chunkDir(uploadId);
      try {
        await fsp.access(dir);
      } catch {
        return reply.code(404).send({ error: 'Unknown uploadId — init first' });
      }

      // Verify user owns this upload
      try {
        const metaRaw = await fsp.readFile(path.join(dir, 'meta.json'), 'utf-8');
        const meta = JSON.parse(metaRaw);
        if (meta.userId !== request.user!.id) {
          return reply.code(403).send({ error: 'Not your upload' });
        }
      } catch {
        return reply.code(500).send({ error: 'Failed to read upload metadata' });
      }

      // Body is raw Buffer from the * content-type parser
      const chunk = request.body as Buffer;
      if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
        return reply.code(400).send({ error: 'Empty or invalid chunk body' });
      }

      await fsp.writeFile(partPath(uploadId, partNum), chunk);

      return reply.send({ ok: true, part: partNum, size: chunk.length });
    }
  );

  /**
   * POST /upload/local/complete
   * Assemble all chunks, virus scan, save to storage, cleanup temp directory.
   */
  app.post(
    '/upload/local/complete',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { uploadId } = request.body as { uploadId: string };

      if (!uploadId) {
        return reply.code(400).send({ error: 'uploadId required' });
      }

      const dir = chunkDir(uploadId);
      let meta: {
        originalName: string;
        filename: string;
        mimeType: string;
        totalParts: number;
        totalSize: number;
        expiresInDays: number | null;
        userId: number;
      };

      try {
        const metaRaw = await fsp.readFile(path.join(dir, 'meta.json'), 'utf-8');
        meta = JSON.parse(metaRaw);
      } catch {
        return reply.code(404).send({ error: 'Unknown uploadId — init first' });
      }

      if (meta.userId !== request.user!.id) {
        return reply.code(403).send({ error: 'Not your upload' });
      }

      // Verify all parts are present
      for (let i = 1; i <= meta.totalParts; i++) {
        try {
          await fsp.access(partPath(uploadId, i));
        } catch {
          return reply.code(400).send({
            error: `Missing part ${i} of ${meta.totalParts}`,
          });
        }
      }

      const tmpPath = path.join(os.tmpdir(), `linqoy-assembled-${meta.filename}`);

      try {
        // Assemble chunks sequentially into a single temp file
        const writeStream = fs.createWriteStream(tmpPath);
        for (let i = 1; i <= meta.totalParts; i++) {
          const chunk = await fsp.readFile(partPath(uploadId, i));
          writeStream.write(chunk);
        }
        await new Promise<void>((resolve, reject) => {
          writeStream.end((err: Error | null) => (err ? reject(err) : resolve()));
        });

        // Delegate virus scan + storage save + DB record to shared helper
        await saveFromPath(
          tmpPath,
          meta.filename,
          meta.originalName,
          meta.mimeType,
          meta.userId,
          request.user!.username,
          meta.expiresInDays ?? undefined,
          meta.totalSize
        );

        writeLog({
          time: new Date().toISOString(),
          level: 20,
          levelName: 'debug',
          category: 'debug',
          msg: `Local chunked complete: ${meta.originalName} uploadId=${uploadId} parts=${meta.totalParts} size=${meta.totalSize}`,
          user: request.user!.username,
          method: 'POST',
          url: '/upload/local/complete',
          reqId: request.id,
        });

        return reply.send({
          data: { url: `${BASE_URL}/file/${meta.filename}` },
        });
      } catch (err) {
        const e = err as { statusCode?: number; message: string };
        if (!reply.sent) {
          return reply.code(e.statusCode || 500).send({ error: e.message });
        }
      } finally {
        // Cleanup: remove assembled temp file + all chunks
        try { fs.unlinkSync(tmpPath); } catch { /* */ }
        await fsp.rm(dir, { recursive: true, force: true });
      }
    }
  );
}
