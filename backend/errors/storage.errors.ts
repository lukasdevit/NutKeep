import { createError } from './error.factory.js';

/**
 * Map raw S3/B2/R2 errors for general storage operations (not CORS-specific).
 * Overlaps with mapCorsError but kept separate — each domain owns its mapping.
 */
export function mapStorageError(err: Error, backend: string) {
  const msg = err.message ?? '';
  const rawCode =
    ((err as unknown as Record<string, unknown>).name as string) ||
    ((err as unknown as Record<string, unknown>).Code as string) ||
    '';
  const label = backend.toUpperCase();
  const lower = msg.toLowerCase();
  const lowerCode = rawCode.toLowerCase();

  if (
    lowerCode === 'nosuchbucket' ||
    (lower.includes('bucket') && lower.includes('not found'))
  ) {
    return createError(
      'STORAGE_BUCKET_NOT_FOUND',
      'storage.bucket_not_found',
      400,
      `${label} bucket not found. Check Storage Configuration.`,
    );
  }

  if (
    lowerCode === 'accessdenied' ||
    lowerCode === 'forbidden' ||
    lower.includes('access denied')
  ) {
    return createError(
      'STORAGE_ACCESS_DENIED',
      'storage.access_denied',
      403,
      `${label} access denied. Check bucket permissions.`,
    );
  }

  if (
    lowerCode === 'invalidaccesskeyid' ||
    lower.includes('access key') ||
    lower.includes('secret') ||
    lower.includes('credentials')
  ) {
    return createError(
      'STORAGE_INVALID_CREDENTIALS',
      'storage.invalid_credentials',
      400,
      `${label} authentication failed. Check your credentials.`,
    );
  }

  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lowerCode === 'networkingerror'
  ) {
    return createError(
      'STORAGE_ENDPOINT_UNREACHABLE',
      'storage.endpoint_unreachable',
      400,
      `${label} endpoint unreachable. Check the endpoint URL.`,
    );
  }

  return createError(
    'STORAGE_UNKNOWN_ERROR',
    'storage.unknown_error',
    502,
    `${label} error: ${rawCode ? rawCode + ' — ' : ''}${msg || 'Unknown error'}`,
    msg || undefined,
  );
}

export function storageNoValidFieldsError() {
  return createError('STORAGE_NO_VALID_FIELDS', 'storage.no_valid_fields', 400, 'No valid fields to update');
}
