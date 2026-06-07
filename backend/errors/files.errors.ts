import { createError } from './error.factory.js';

/** Maps file-service domain errors to standardized ApiErrors */
export function mapFileError(err: Error) {
  const code = (err as unknown as Record<string, unknown>).code as string | undefined;
  const msg = err.message;

  if (code === 'FILE_NOT_FOUND' || msg.includes('not found')) {
    return createError('FILE_NOT_FOUND', 'file.not_found', 404, msg);
  }

  if (code === 'NOT_YOUR_FILE' || msg.includes('Not your file')) {
    return createError('FILE_NOT_YOURS', 'file.not_yours', 403, msg);
  }

  if (code === 'FILE_PRIVATE' || msg.includes('private')) {
    return createError('FILE_PRIVATE', 'file.private', 403, msg);
  }

  if (code === 'FILE_MISSING_STORAGE' || msg.includes('missing from storage')) {
    return createError('FILE_MISSING_FROM_STORAGE', 'file.missing_from_storage', 500, msg);
  }

  if (code === 'INVALID_FILENAME' || msg.includes('Invalid filename')) {
    return createError('FILE_INVALID_NAME', 'file.invalid_name', 400, msg);
  }

  return createError('INTERNAL_ERROR', 'common.internal_error', 500, msg || 'Internal server error', msg);
}

export function fileNotFoundError(filename?: string) {
  return createError(
    'FILE_NOT_FOUND',
    'file.not_found',
    404,
    filename ? `File "${filename}" not found` : 'File not found',
  );
}

export function fileNotYoursError() {
  return createError('FILE_NOT_YOURS', 'file.not_yours', 403, 'Not your file');
}

export function filePrivateError() {
  return createError('FILE_PRIVATE', 'file.private', 403, 'This file is private');
}

export function fileInvalidNameError() {
  return createError('FILE_INVALID_NAME', 'file.invalid_name', 400, 'Invalid filename');
}
