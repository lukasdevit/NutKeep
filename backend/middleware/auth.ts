import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/index.js';
import { writeLog } from '../services/log-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export interface JwtPayload {
  id: number;
  username: string;
  isAdmin: boolean;
  isDemo: boolean;
}

export function signToken(
  userId: number,
  username: string,
  isAdmin: boolean,
  isDemo = false
): string {
  return jwt.sign({ id: userId, username, isAdmin, isDemo }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenFromHeader(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = getTokenFromHeader(request);
  if (!token) {
    writeLog({
      time: new Date().toISOString(),
      level: 40,
      levelName: 'warn',
      category: 'security',
      msg: 'Auth failure: missing token',
      method: request.method,
      url: request.url,
      reqId: request.id,
    });
    return reply.code(401).send({ error: 'Missing token' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    writeLog({
      time: new Date().toISOString(),
      level: 40,
      levelName: 'warn',
      category: 'security',
      msg: 'Auth failure: invalid or expired token',
      method: request.method,
      url: request.url,
      reqId: request.id,
    });
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
  request.user = payload;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!request.user?.isAdmin) {
    writeLog({
      time: new Date().toISOString(),
      level: 40,
      levelName: 'warn',
      category: 'security',
      msg: `Admin access denied for user: ${request.user?.username || 'unknown'}`,
      user: request.user?.username,
      method: request.method,
      url: request.url,
      reqId: request.id,
    });
    return reply.code(403).send({ error: 'Admin only' });
  }
}
