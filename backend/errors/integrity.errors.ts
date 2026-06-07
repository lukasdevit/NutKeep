import { createError } from './error.factory.js';

export function integrityCheckNotFoundError() {
  return createError('INTEGRITY_CHECK_NOT_FOUND', 'integrity.check_not_found', 404, 'Check not found');
}

export function integrityMissingParamError(param: string) {
  return createError('INTEGRITY_MISSING_PARAM', 'integrity.missing_param', 400, `Missing path parameter: ${param}`);
}

export function integrityForbiddenError() {
  return createError('INTEGRITY_FORBIDDEN', 'integrity.forbidden', 403, 'Forbidden');
}
