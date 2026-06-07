import type { ApiError, ErrorCode } from './types.js';

/** Create a standardized API error — never construct ApiError objects manually */
export function createError(
  code: ErrorCode,
  messageKey: string,
  status: number,
  message?: string,
  details?: string,
): ApiError {
  return Object.assign(
    { code, messageKey, message: message ?? messageKey, status },
    details !== undefined ? { details } : {},
  ) as ApiError;
}
