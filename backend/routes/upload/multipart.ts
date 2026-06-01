import path from 'path';

import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { requireAuth } from '../../middleware/index.js';
import { BASE_URL } from '../../config/index.js';
import { sanitizeFilename, validateFile, checkStorageQuota, finalizeFile } from '../../services/files/index.js';
import { buildStorageKey, getCurrentS3Client } from '../../services/storage/index.js';

const PRESIGN_EXPIRY_SECONDS = 3600; // 1 hour per part URL

// Server-side presigned URL storage — never exposed to browser
const proxyTokens = new Map<string, string>();

export async function multipartUploadRoutes(app: FastifyInstance) {
  /**
   * POST /upload/multipart/init
   * Initiate a multipart upload. Returns uploadId and key.
   */
  app.post(
    '/upload/multipart/init',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = request.body as {
        filename: string;
        mimeType: string;
        expiresInDays?: number;
      };

      if (!body.filename || !body.mimeType) {
        return reply.code(400).send({ error: 'filename and mimeType required' });
      }

      const originalName = sanitizeFilename(body.filename);
      const validationError = validateFile(body.mimeType, originalName);
      if (validationError) {
        return reply.code(415).send({ error: validationError });
      }

      try {
        await checkStorageQuota(1, request.user!.id);
      } catch (err) {
        const e = err as { statusCode?: number; message: string };
        return reply.code(e.statusCode || 507).send({ error: e.message });
      }

      const id = nanoid(10);
      const ext = path.extname(originalName);
      const filename = `${id}${ext}`;
      const key = await buildStorageKey(request.user!.id, filename);

      const { client: s3, bucket } = await getCurrentS3Client();
      const createCmd = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: body.mimeType,
      });

      const { UploadId } = await s3.send(createCmd);

      return reply.send({
        data: {
          uploadId: UploadId,
          key,
          filename: filename,
        },
      });
    }
  );

  /**
   * POST /upload/multipart/sign-part
   * Returns a presigned URL for uploading a single part.
   * Uses POST body to avoid URL-encoding issues with keys containing slashes.
   */
  app.post(
    '/upload/multipart/sign-part',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const { key, uploadId, partNumber } = request.body as {
          key: string;
          uploadId: string;
          partNumber: number;
        };

        if (!key || !uploadId || !partNumber) {
          return reply.code(400).send({ error: 'key, uploadId, and partNumber required' });
        }

        const { client: s3, bucket } = await getCurrentS3Client();
        const cmd = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });

        const url = await getSignedUrl(s3, cmd, {
          expiresIn: PRESIGN_EXPIRY_SECONDS,
        });

        // Store presigned URL server-side — never expose it to the browser
        const token = nanoid(32);
        proxyTokens.set(token, url);
        // Auto-expire after presigned URL expires
        setTimeout(() => proxyTokens.delete(token), PRESIGN_EXPIRY_SECONDS * 1000);

        return reply.send({
          data: {
            url: `${BASE_URL}/upload/multipart/part-proxy/${token}`,
          },
        });
      } catch (err) {
        const e = err as Error;
        app.log.error({ err: e }, 'sign-part failed');
        return reply.code(500).send({ error: `sign-part failed: ${e.message}` });
      }
    }
  );

  /**
   * PUT /upload/multipart/part-proxy/:token
   * Proxies part upload to B2. Token maps to a server-side presigned URL.
   * No auth needed — the presigned URL IS the authorization.
   */
  app.put(
    '/upload/multipart/part-proxy/:token',
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const presignedUrl = proxyTokens.get(token);
      if (!presignedUrl) {
        return reply.code(404).send({ error: 'Token not found or expired' });
      }

      const body = request.body as Buffer;
      if (!body || body.length === 0) {
        return reply.code(400).send({ error: 'no body' });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const upstream = await fetch(presignedUrl, {
          method: 'PUT',
          body: new Uint8Array(body),
          signal: controller.signal,
        });
        if (!upstream.ok) {
          const text = await upstream.text();
          return reply.code(upstream.status).send(text);
        }
        // Return ETag so Uppy can use it for completion
        const etag = upstream.headers.get('etag') || '';
        return reply.header('ETag', etag).code(200).send('');
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return reply.code(504).send({ error: 'Proxy to storage timed out after 30s' });
        }
        return reply.code(502).send({ error: `Proxy failed: ${(err as Error).message}` });
      } finally {
        clearTimeout(timeout);
      }
    }
  );

  /**
   * POST /upload/multipart/:uploadId/complete
   * Complete the multipart upload and create the DB record.
   * Key is passed in body to avoid slash-in-path routing issues.
   */
  app.post(
    '/upload/multipart/:uploadId/complete',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { uploadId } = request.params as { uploadId: string };

      const body = request.body as {
        key: string;
        parts: { PartNumber: number; ETag: string }[];
        originalName: string;
        mimeType: string;
        size: number;
        expiresInDays?: number;
      };

      if (!body.key || !body.parts || !Array.isArray(body.parts)) {
        return reply.code(400).send({ error: 'key and parts array required' });
      }

      const { client: s3, bucket } = await getCurrentS3Client();
      const cmd = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: body.key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: body.parts.map((p) => ({
            PartNumber: p.PartNumber,
            ETag: p.ETag,
          })),
        },
      });

      try {
        await s3.send(cmd);
      } catch (err) {
        return reply.code(500).send({
          error: `Failed to complete upload: ${(err as Error).message}`,
        });
      }

      const filename = path.basename(body.key);
      const size = body.size || 0;
      try {
        await checkStorageQuota(size, request.user!.id);
      } catch (err) {
        return reply
          .code((err as { statusCode?: number }).statusCode || 500)
          .send({ error: (err as Error).message });
      }

      const fileParams: {
        filename: string;
        originalName: string;
        storageKey: string;
        mimeType: string;
        size: number;
        userId: number;
        expiresInDays?: number;
      } = {
        filename,
        originalName: sanitizeFilename(body.originalName || filename),
        storageKey: body.key,
        mimeType: body.mimeType || 'application/octet-stream',
        size,
        userId: request.user!.id,
      };
      if (body.expiresInDays !== undefined) fileParams.expiresInDays = body.expiresInDays;
      try {
        await finalizeFile(fileParams);
      } catch (err) {
        return reply
          .code((err as { statusCode?: number }).statusCode || 500)
          .send({ error: (err as Error).message });
      }

      return reply.send({
        data: {
          url: `${BASE_URL}/file/${filename}`,
          key: body.key,
        },
      });
    }
  );

  /**
   * DELETE /upload/multipart/:uploadId
   * Abort an in-progress multipart upload. Key in body.
   */
  app.delete(
    '/upload/multipart/:uploadId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { uploadId } = request.params as { uploadId: string };
      const { key } = request.body as { key: string };   

      const { client: s3, bucket } = await getCurrentS3Client();
      const cmd = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      });

      await s3.send(cmd);
      return reply.send({ data: { aborted: true } });
    }
  );
}
