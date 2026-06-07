import { createError } from './error.factory.js';
import { ERROR_CODES } from './codes.js';

/** Maps auth-service domain errors to standardized ApiErrors */
export function mapAuthError(err: Error) {
  const code = (err as unknown as Record<string, unknown>).code as string | undefined;
  const msg = err.message;

  // Duplicate username
  if (code === ERROR_CODES.AUTH_USERNAME_TAKEN || code === 'DUPLICATE_USERNAME' || msg.includes('already taken')) {
    return createError('AUTH_USERNAME_TAKEN', 'auth.username_taken', 409, msg);
  }

  // Registrations disabled
  if (code === ERROR_CODES.AUTH_REGISTRATIONS_DISABLED || code === 'REGISTRATIONS_DISABLED' || msg.includes('disabled')) {
    return createError('AUTH_REGISTRATIONS_DISABLED', 'auth.registrations_disabled', 403, msg);
  }

  // Invalid credentials
  if (code === ERROR_CODES.AUTH_INVALID_CREDENTIALS || code === 'INVALID_CREDENTIALS' || msg.includes('Invalid username or password')) {
    return createError('AUTH_INVALID_CREDENTIALS', 'auth.invalid_credentials', 401, msg);
  }

  // Account locked
  if (code === ERROR_CODES.AUTH_ACCOUNT_LOCKED || code === 'ACCOUNT_LOCKED' || msg.includes('locked')) {
    return createError('AUTH_ACCOUNT_LOCKED', 'auth.account_locked', 423, msg);
  }

  // User not found
  if (code === ERROR_CODES.AUTH_USER_NOT_FOUND || code === 'USER_NOT_FOUND' || msg.includes('not found')) {
    return createError('AUTH_USER_NOT_FOUND', 'auth.user_not_found', 404, msg);
  }

  // Wrong current password
  if (code === ERROR_CODES.AUTH_WRONG_PASSWORD || code === 'WRONG_PASSWORD' || msg.includes('password is incorrect')) {
    return createError('AUTH_WRONG_PASSWORD', 'auth.wrong_password', 401, msg);
  }

  // Demo limit reached
  if (code === ERROR_CODES.AUTH_DEMO_LIMIT_REACHED || code === 'DEMO_LIMIT' || msg.includes('limit reached')) {
    return createError('AUTH_DEMO_LIMIT_REACHED', 'auth.demo_limit_reached', 429, msg);
  }

  // Self-delete
  if (code === 'SELF_DELETE' || msg.includes('delete yourself') || msg.includes('your own')) {
    return createError('AUTH_SELF_DELETE', 'auth.self_delete', 400, msg);
  }

  // Fallback
  return createError('INTERNAL_ERROR', 'common.internal_error', 500, msg || 'Internal server error', msg);
}

// ── Middleware-specific errors ──────────────────────────────────

export function authMissingTokenError() {
  return createError('AUTH_MISSING_TOKEN', 'auth.missing_token', 401, 'Missing token');
}

export function authInvalidTokenError() {
  return createError('AUTH_INVALID_TOKEN', 'auth.invalid_token', 401, 'Invalid or expired token');
}

export function authForbiddenError() {
  return createError('AUTH_FORBIDDEN', 'auth.forbidden', 403, 'Admin only');
}

export function authNotDemoSessionError() {
  return createError('AUTH_NOT_DEMO_SESSION', 'auth.not_demo_session', 403, 'Not a demo session');
}

export function authUserNotFoundError() {
  return createError('AUTH_USER_NOT_FOUND', 'auth.user_not_found', 404, 'User not found');
}
