/** Core error code — every error in the system has one of these */
export type ErrorCode =
  // ── CORS ──────────────────────────────────────────
  | 'CORS_BUCKET_NOT_FOUND'
  | 'CORS_ACCESS_DENIED'
  | 'CORS_INVALID_CREDENTIALS'
  | 'CORS_ENDPOINT_UNREACHABLE'
  | 'CORS_UNSUPPORTED_BACKEND'
  | 'CORS_UNKNOWN_ERROR'
  // ── AUTH ──────────────────────────────────────────
  | 'AUTH_MISSING_TOKEN'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_USERNAME_TAKEN'
  | 'AUTH_REGISTRATIONS_DISABLED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_ACCOUNT_LOCKED'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_WRONG_PASSWORD'
  | 'AUTH_DEMO_LIMIT_REACHED'
  | 'AUTH_NOT_DEMO_SESSION'
  | 'AUTH_SELF_DELETE'
  // ── FILES ─────────────────────────────────────────
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_YOURS'
  | 'FILE_PRIVATE'
  | 'FILE_MISSING_FROM_STORAGE'
  | 'FILE_INVALID_NAME'
  // ── UPLOAD ────────────────────────────────────────
  | 'UPLOAD_NO_FILE'
  | 'UPLOAD_MISSING_PARAMS'
  | 'UPLOAD_INVALID_PARAMS'
  | 'UPLOAD_UNSUPPORTED_TYPE'
  | 'UPLOAD_QUOTA_SERVER'
  | 'UPLOAD_QUOTA_USER'
  | 'UPLOAD_FILE_TOO_LARGE'
  | 'UPLOAD_MALWARE_DETECTED'
  | 'UPLOAD_SIZE_MISMATCH'
  | 'UPLOAD_UNKNOWN_ID'
  | 'UPLOAD_NOT_YOURS'
  | 'UPLOAD_CORRUPT_METADATA'
  // ── STORAGE (S3/B2/R2) ────────────────────────────
  | 'STORAGE_BUCKET_NOT_FOUND'
  | 'STORAGE_ACCESS_DENIED'
  | 'STORAGE_INVALID_CREDENTIALS'
  | 'STORAGE_ENDPOINT_UNREACHABLE'
  | 'STORAGE_NO_VALID_FIELDS'
  | 'STORAGE_UNKNOWN_ERROR'
  // ── DB ───────────────────────────────────────────
  | 'DB_INVALID_TABLE'
  | 'DB_LAST_ADMIN'
  // ── INTEGRITY ─────────────────────────────────────
  | 'INTEGRITY_CHECK_NOT_FOUND'
  | 'INTEGRITY_MISSING_PARAM'
  | 'INTEGRITY_FORBIDDEN'
  // ── BACKUP ────────────────────────────────────────
  | 'BACKUP_NOT_FOUND'
  | 'BACKUP_NO_FILE'
  | 'BACKUP_INVALID_FILE'
  // ── ACTIONS ───────────────────────────────────────
  | 'ACTION_NOT_FOUND'
  // ── VALIDATION ────────────────────────────────────
  | 'VALIDATION_ERROR'
  // ── GENERIC ───────────────────────────────────────
  | 'INTERNAL_ERROR';

/** Standard API error returned by every endpoint */
export type ApiError = {
  code: ErrorCode;
  message: string;       // fallback / dev / logs (English)
  messageKey: string;    // i18n key for frontend translations
  status: number;
  details?: string;
};
