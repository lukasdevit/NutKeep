import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  requireAuth,
  signToken,
} from '../middleware/index.js';
import {
  DB_PATH,
  AUTH_LOGIN_LIMIT,
  AUTH_REGISTER_LIMIT,
  AUTH_RATE_WINDOW_MS,
} from '../config/index.js';
import {
  registerUser,
  loginUser,
  changeUserPassword,
  getUserStorageInfo,
  createDemoAccount,
  cleanupDemoSession,
} from '../services/auth-service.js';
import { DEMO_IP_RATE_LIMIT, DEMO_RATE_WINDOW_MS } from '../config/index.js';
import { writeLog } from '../services/log-service.js';
import { sendError, mapAuthError, authNotDemoSessionError } from '../errors/index.js';

export async function authRoutes(app: FastifyInstance) {
  const isTest = DB_PATH.includes('test');

  const registerSchema = {
    body: {
      type: 'object' as const,
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 3 },
        password: { type: 'string', minLength: 6 },
      },
    },
  };

  const loginSchema = {
    body: {
      type: 'object' as const,
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
      },
    },
  };

  const changePasswordSchema = {
    body: {
      type: 'object' as const,
      required: ['currentPassword', 'newPassword'],
      properties: {
        currentPassword: { type: 'string' },
        newPassword: { type: 'string', minLength: 6 },
      },
    },
  };

  app.post(
    '/auth/register',
    {
      schema: registerSchema,
      ...(isTest
        ? {}
        : {
            config: {
              rateLimit: { max: AUTH_REGISTER_LIMIT, timeWindow: AUTH_RATE_WINDOW_MS },
            },
          }),
    },
    async (request, reply) => {
      const { username, password } = request.body as {
        username: string;
        password: string;
      };

      try {
        const user = await registerUser(username, password, isTest);
        const token = signToken(user.id, user.username, user.isAdmin);
        return reply.send({ token, user });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.post(
    '/auth/login',
    {
      schema: loginSchema,
      ...(isTest
        ? {}
        : {
            config: {
              rateLimit: { max: AUTH_LOGIN_LIMIT, timeWindow: AUTH_RATE_WINDOW_MS },
            },
          }),
    },
    async (request, reply) => {
      const { username, password } = request.body as {
        username: string;
        password: string;
      };

      try {
        const user = await loginUser(username, password);
        const token = signToken(user.id, user.username, user.isAdmin);
        writeLog({
          time: new Date().toISOString(),
          level: 30,
          levelName: 'info',
          category: 'security',
          msg: `Login success: ${username}`,
          user: username,
          method: 'POST',
          url: '/auth/login',
          reqId: request.id,
        });
        return reply.send({ token, user });
      } catch (err) {
        writeLog({
          time: new Date().toISOString(),
          level: 40,
          levelName: 'warn',
          category: 'security',
          msg: `Login failure: ${username} — ${(err as Error).message}`,
          user: username,
          method: 'POST',
          url: '/auth/login',
          reqId: request.id,
        });
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.get('/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.user!;
    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        isDemo: user.isDemo,
      },
    });
  });

  app.post(
    '/auth/change-password',
    {
      preHandler: [requireAuth],
      schema: changePasswordSchema,
      ...(isTest
        ? {}
        : {
            config: {
              rateLimit: { max: AUTH_LOGIN_LIMIT, timeWindow: AUTH_RATE_WINDOW_MS },
            },
          }),
    },
    async (request, reply) => {
      const user = request.user!;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      try {
        await changeUserPassword(user.id, currentPassword, newPassword);
        writeLog({
          time: new Date().toISOString(),
          level: 30,
          levelName: 'info',
          category: 'security',
          msg: `Password changed for: ${user.username}`,
          user: user.username,
          method: 'POST',
          url: '/auth/change-password',
          reqId: request.id,
        });
        return reply.send({ ok: true });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.get(
    '/auth/storage',
    {
      preHandler: [requireAuth],
      config: {
        rateLimit: { max: 30, timeWindow: 60_000 },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const info = await getUserStorageInfo(user.id);
      return reply.send(info);
    }
  );

  app.post(
    '/auth/demo',
    {
      ...(isTest
        ? {}
        : {
            config: {
              rateLimit: { max: DEMO_IP_RATE_LIMIT, timeWindow: DEMO_RATE_WINDOW_MS },
            },
          }),
    },
    async (request, reply) => {
      try {
        const user = await createDemoAccount(isTest);
        const token = signToken(user.id, user.username, false, true);
        return reply.send({ token, user });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );

  app.post(
    '/auth/demo-session',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      if (!user.isDemo) {
        return sendError(reply, authNotDemoSessionError());
      }

      try {
        await cleanupDemoSession(user.id);
        return reply.send({ ok: true });
      } catch (err) {
        return sendError(reply, mapAuthError(err as Error));
      }
    }
  );
}
