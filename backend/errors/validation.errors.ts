import { createError } from './error.factory.js';

/** Generic validation error for schema / input validation failures */
export function validationError(message: string, details?: string) {
  return createError('VALIDATION_ERROR', 'common.validation_error', 400, message, details);
}
