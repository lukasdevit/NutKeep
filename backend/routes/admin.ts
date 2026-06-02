import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../middleware/index.js';
import { adminUserRoutes } from './admin/users.js';
import { adminDbRoutes } from './admin/db.js';
import { adminStorageRoutes, adminSslRoutes } from './admin/storage.js';
import { adminCorsRoutes } from './admin/cors.js';
import { adminAnalyticsRoutes } from './admin/analytics.js';
import { adminBackupRoutes } from './admin/backup.js';
import { adminBackupManageRoutes } from './admin/backup-manage.js';
import { adminLogRoutes } from './admin/logs.js';
import { adminIntegrityRoutes } from './admin/integrity.js';
import { adminActionsRoutes } from './admin/actions.js';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require admin authentication.
  app.addHook('preHandler', requireAdmin);

  await adminUserRoutes(app);
  await adminDbRoutes(app);
  await adminStorageRoutes(app);
  await adminSslRoutes(app);
  await adminCorsRoutes(app);
  await adminAnalyticsRoutes(app);
  await adminBackupRoutes(app);
  await adminBackupManageRoutes(app);
  await adminLogRoutes(app);
  await adminIntegrityRoutes(app);
  await adminActionsRoutes(app);
}
