import type { FastifyInstance } from 'fastify';
import { parsePagination } from '../../utils/index.js';
import { recordAction } from '../../services/action-log-service.js';
import { clearConfigCache, getStorageBackend } from '../../config/index.js';
import { getSetting, upsertSetting } from '../../repositories/settings-repository.js';
import { findById } from '../../repositories/user-repository.js';
import { findFilesNotOnBackend, updateFileBackendAndPath } from '../../repositories/file-repository.js';
import { resolveProvider, buildStorageKey } from '../../services/storage/index.js';
import {
  createUser,
  listUsersPaginated,
  editUser,
  unlockUserAccount,
  removeUser,
} from '../../services/admin-user-service.js';
import { sendError, mapAuthError, validationError, authUserNotFoundError } from '../../errors/index.js';

export async function adminUserRoutes(app: FastifyInstance) {
  app.get('/admin/users/demo-config', async (_request, reply) => {
    const value = await getSetting('demo_registrations_open');
    const open = value ? value !== 'false' : true;
    return reply.send({ demo_registrations_open: open });
  });

  app.patch('/admin/users/demo-config', async (request, reply) => {
    const { demo_registrations_open } = (request.body || {}) as {
      demo_registrations_open?: boolean;
    };
    if (typeof demo_registrations_open !== 'boolean') {
      return sendError(reply, validationError('demo_registrations_open must be a boolean'));
    }
    await upsertSetting('demo_registrations_open', String(demo_registrations_open));
    clearConfigCache();
    if (request.user?.username) {
      await recordAction(
        request.user!.username,
        'demo-config',
        `Demo registrations ${demo_registrations_open ? 'enabled' : 'disabled'}`,
        { demo_registrations_open }
      );
    }
    return reply.send({ ok: true, demo_registrations_open });
  });

  const createUserSchema = {
    body: {
      type: 'object' as const,
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 3 },
        password: { type: 'string', minLength: 6 },
        is_admin: { type: 'boolean' },
        storage_limit: { type: 'number', minimum: 1 },
      },
    },
  };

  const patchUserSchema = {
    body: {
      type: 'object' as const,
      minProperties: 1,
      properties: {
        storage_limit: { type: 'number', minimum: 0 },
        is_admin: { type: 'boolean' },
        new_password: { type: 'string', minLength: 6 },
      },
    },
  };

  app.post(
    '/admin/users',
    { schema: createUserSchema },
    async (request, reply) => {
      const { username, password, is_admin, storage_limit } = request.body as {
        username: string;
        password: string;
        is_admin?: boolean;
        storage_limit?: number;
      };

      try {
        const result = await createUser(
          {
            username,
            password,
            ...(is_admin !== undefined ? { isAdmin: is_admin } : {}),
            ...(storage_limit !== undefined ? { storageLimit: storage_limit } : {}),
          },
          request.user?.username
        );
        return reply.send(result);
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.get('/admin/users', async (request, reply) => {
    const { page, limit, search } = parsePagination(
      request.query as Record<string, string>
    );
    try {
      const result = await listUsersPaginated({ page, limit, search });
      return reply.send(result);
    } catch (err) {
      return sendError(reply, mapAuthError(err as Error));
    }
  });

  app.patch(
    '/admin/users/:id',
    { schema: patchUserSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { storage_limit, is_admin, new_password } = request.body as {
        storage_limit?: number;
        is_admin?: boolean;
        new_password?: string;
      };

      try {
        await editUser(
          parseInt(id, 10),
          {
            ...(storage_limit !== undefined ? { storageLimit: storage_limit } : {}),
            ...(is_admin !== undefined ? { isAdmin: is_admin } : {}),
            ...(new_password !== undefined ? { newPassword: new_password } : {}),
          },
          request.user?.username
        );
        return reply.send({ ok: true });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.post('/admin/users/:id/unlock', async (request, reply) => {
    const userId = Number((request.params as { id: string }).id);
    try {
      await unlockUserAccount(userId);
      return reply.send({ ok: true });
    } catch (err) {
      return sendError(reply, mapAuthError(err as Error));
    }
  });

  app.delete('/admin/users/:id', async (request, reply) => {
    const userId = Number((request.params as { id: string }).id);
    try {
      const result = await removeUser(userId, request.user!.id, request.user?.username);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendError(reply, mapAuthError(err as Error));
    }
  });

  // ── File migration ──

  app.get(
    '/admin/users/:id/migrate-files-preview',
    async (request, reply) => {
      const userId = Number((request.params as { id: string }).id);
      try {
        const currentBackend = await getStorageBackend();
        const files = await findFilesNotOnBackend(userId, currentBackend);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        return reply.send({
          count: files.length,
          totalSize,
          backend: currentBackend,
          files: files.map((f) => ({
            id: f.id,
            filename: f.filename,
            originalName: f.original_name,
            fromBackend: f.storage_backend,
            size: f.size,
          })),
        });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.post(
    '/admin/users/:id/migrate-files',
    async (request, reply) => {
      const userId = Number((request.params as { id: string }).id);
      try {
        const user = await findById(userId);
        if (!user) return sendError(reply, mapAuthError(new Error('User not found')));

        const currentBackend = await getStorageBackend();
        const files = await findFilesNotOnBackend(userId, currentBackend);

        if (files.length === 0) {
          return reply.send({ ok: true, migrated: 0, message: 'No files to migrate' });
        }

        const newProvider = resolveProvider(currentBackend);
        const migrated: number[] = [];
        const errors: { id: number; filename: string; error: string }[] = [];

        for (const file of files) {
          try {
            const oldProvider = resolveProvider(file.storage_backend);
            const newKey = await buildStorageKey(user.username, file.filename);

            // Read from old backend → write to new backend
            const stream = await oldProvider.createReadStream(file.path);
            await newProvider.save(newKey, stream);

            // Delete from old backend
            try { await oldProvider.delete(file.path); } catch { /* ok if gone */ }

            // Update DB record
            await updateFileBackendAndPath(file.id, newKey, currentBackend);

            migrated.push(file.id);
          } catch (err) {
            errors.push({
              id: file.id,
              filename: file.filename,
              error: (err as Error).message,
            });
          }
        }

        if (request.user?.username) {
          await recordAction(
            request.user!.username,
            'file-migrate',
            `Migrated ${migrated.length} files for user ${user.username} to ${currentBackend}`,
            { userId, migrated, errors: errors.length }
          );
        }

        return reply.send({
          ok: errors.length === 0,
          migrated: migrated.length,
          errors,
          backend: currentBackend,
        });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );
}
