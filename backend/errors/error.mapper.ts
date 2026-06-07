import type { FastifyReply } from 'fastify';
import type { ApiError } from './types.js';

/** Send a standardized ApiError through a Fastify reply — the single touchpoint between errors and HTTP */
export function sendError(reply: FastifyReply, err: ApiError): void {
  reply.code(err.status).send({
    code: err.code,
    messageKey: err.messageKey,
    message: err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
