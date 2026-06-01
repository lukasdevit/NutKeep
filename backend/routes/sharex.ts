import type { FastifyInstance } from 'fastify';
import { requireAuth, getTokenFromHeader } from '../middleware/index.js';
import { BASE_URL } from '../config/index.js';

export async function sharexRoutes(app: FastifyInstance) {
  // ShareX uploads go through the unified /upload endpoint (same as web frontend).
  // Cloudflare free plan caps single requests at 100 MB — for larger files use the web frontend.

  app.get(
    '/sharex/config',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const token = getTokenFromHeader(request);
      const username = request.user?.username || 'NutKeep';
      const config = {
        Version: '17.0.0',
        Name: `NutKeep - ${username}`,
        DestinationType: 'ImageUploader,FileUploader',
        RequestMethod: 'POST',
        RequestURL: `${BASE_URL}/upload`,
        FileFormName: 'file',
        Body: 'MultipartFormData',
        Headers: { Authorization: `Bearer ${token}` },
        URL: '{json:url}',
      };
      return reply
        .header('Content-Type', 'application/json')
        .header(
          'Content-Disposition',
          `attachment; filename="NutKeep-${username}.sxcu"`
        )
        .send(config);
    }
  );
}
