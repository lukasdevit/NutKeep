import { createError } from './error.factory.js';

/**
 * Map raw S3/B2/R2 errors to standardized ApiErrors.
 * Handles AWS SDK errors (where .name holds the error code) as well as
 * Node.js system errors (ENOTFOUND, etc.).
 */
export function mapCorsError(err: Error, backend: string) {
  const msg = err.message ?? '';
  const rawCode =
    ((err as unknown as Record<string, unknown>).name as string) ||
    ((err as unknown as Record<string, unknown>).Code as string) ||
    '';
  const label = backend.toUpperCase();
  const lower = msg.toLowerCase();
  const lowerCode = rawCode.toLowerCase();

  // ── Credentials ──────────────────────────────────
  if (
    lowerCode === 'credentialsisnotvalid' ||
    lower.includes('credentials not configured') ||
    lower.includes('key_id') ||
    lower.includes('access_key')
  ) {
    return createError(
      'CORS_INVALID_CREDENTIALS',
      'cors.invalid_credentials',
      400,
      `${label} credentials not configured. Check Storage Configuration.`,
    );
  }

  // ── Auth / bad key ───────────────────────────────
  if (
    lowerCode === 'invalidaccesskeyid' ||
    lowerCode === 'signaturedoesnotmatch' ||
    lower.includes('invalidaccesskeyid') ||
    lower.includes('signaturedoesnotmatch') ||
    lower.includes('access key id') ||
    lower.includes('secret access key') ||
    lower.includes('security token')
  ) {
    return createError(
      'CORS_INVALID_CREDENTIALS',
      'cors.invalid_credentials',
      400,
      `${label} authentication failed. Check your credentials (access key / secret key).`,
    );
  }

  // ── Bucket not found ─────────────────────────────
  if (
    lowerCode === 'nosuchbucket' ||
    lowerCode === 'notfound' ||
    lower.includes('nosuchbucket') ||
    (lower.includes('bucket') && lower.includes('not found'))
  ) {
    return createError(
      'CORS_BUCKET_NOT_FOUND',
      'cors.bucket_not_found',
      400,
      `${label} bucket not found. Check the bucket name in Storage Configuration.`,
    );
  }

  // ── Access denied ────────────────────────────────
  if (
    lowerCode === 'accessdenied' ||
    lowerCode === 'forbidden' ||
    lower.includes('accessdenied') ||
    lower.includes('forbidden') ||
    lower.includes('access denied')
  ) {
    return createError(
      'CORS_ACCESS_DENIED',
      'cors.access_denied',
      403,
      `${label} access denied. The configured key may not have permission to manage CORS.`,
    );
  }

  // ── Endpoint / network ───────────────────────────
  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('dns') ||
    lowerCode === 'networkingerror' ||
    lower.includes('resolve')
  ) {
    return createError(
      'CORS_ENDPOINT_UNREACHABLE',
      'cors.endpoint_unreachable',
      400,
      `${label} endpoint unreachable. Check the endpoint URL in Storage Configuration.`,
    );
  }

  // ── B2 Native CORS (S3-incompatible mode) ────────
  if (lower.includes('b2 native cors') || lower.includes('b2 native api')) {
    return createError(
      'CORS_ACCESS_DENIED',
      'cors.access_denied',
      400,
      'B2 bucket uses Native CORS rules. In the B2 console, go to bucket settings → CORS Rules → switch to "S3 Compatible API" or "Both".',
    );
  }

  // ── Unsupported HTTP method in CORS rules ────────
  if (lower.includes('unsupported http method') || lower.includes('unsupported method')) {
    return createError(
      'CORS_UNKNOWN_ERROR',
      'cors.unsupported_method',
      400,
      'CORS rules contain an unsupported HTTP method (e.g. OPTIONS). Remove it — OPTIONS is handled automatically by CORS.',
    );
  }

  // ── Fallback ─────────────────────────────────────
  return createError(
    'CORS_UNKNOWN_ERROR',
    'cors.unknown_error',
    502,
    `${label} error: ${rawCode ? rawCode + ' — ' : ''}${msg || 'Unknown error'}`,
    msg || undefined,
  );
}
