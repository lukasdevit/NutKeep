import { createError } from './error.factory.js';

/** Maps upload-service domain errors to standardized ApiErrors */
export function mapUploadError(err: Error) {
  const code = (err as unknown as Record<string, unknown>).code as string | undefined;
  const msg = err.message;

  // ── Pass-through known error codes ────────────────
  if (code) {
    // Backup errors
    if (code === 'BACKUP_INVALID_FILE') return createError('BACKUP_INVALID_FILE', 'backup.invalid_file', 400, msg);
    if (code === 'BACKUP_NOT_FOUND') return createError('BACKUP_NOT_FOUND', 'backup.not_found', 404, msg);
    // Storage errors
    if (code === 'UPLOAD_QUOTA_SERVER') return createError('UPLOAD_QUOTA_SERVER', 'upload.quota_server', 507, msg);
    if (code === 'UPLOAD_QUOTA_USER') return createError('UPLOAD_QUOTA_USER', 'upload.quota_user', 413, msg);
    if (code === 'UPLOAD_FILE_TOO_LARGE') return createError('UPLOAD_FILE_TOO_LARGE', 'upload.file_too_large', 413, msg);
    if (code === 'UPLOAD_UNSUPPORTED_TYPE') return createError('UPLOAD_UNSUPPORTED_TYPE', 'upload.unsupported_type', 415, msg);
    if (code === 'UPLOAD_SIZE_MISMATCH') return createError('UPLOAD_SIZE_MISMATCH', 'upload.size_mismatch', 400, msg);
    if (code === 'UPLOAD_MALWARE_DETECTED') return createError('UPLOAD_MALWARE_DETECTED', 'upload.malware_detected', 422, msg);
  }

  if (msg.includes('No file was uploaded') || msg.includes('No file')) {
    return createError('UPLOAD_NO_FILE', 'upload.no_file', 400, msg);
  }

  if (msg.includes('Unsupported') || msg.includes('type') && !msg.includes('endpoint')) {
    return createError('UPLOAD_UNSUPPORTED_TYPE', 'upload.unsupported_type', 415, msg);
  }

  if (msg.includes('server storage limit') || msg.includes('Server storage')) {
    return createError('UPLOAD_QUOTA_SERVER', 'upload.quota_server', 507, msg);
  }

  if (msg.includes('quota exceeded') || msg.includes('Storage quota')) {
    return createError('UPLOAD_QUOTA_USER', 'upload.quota_user', 413, msg);
  }

  if (msg.includes('File too large') || msg.includes('exceeds max file size') || msg.includes('file size limit')) {
    return createError('UPLOAD_FILE_TOO_LARGE', 'upload.file_too_large', 413, msg);
  }

  if (msg.includes('malware') || msg.includes('could not be uploaded')) {
    return createError('UPLOAD_MALWARE_DETECTED', 'upload.malware_detected', 422, msg);
  }

  if (msg.includes('Size mismatch')) {
    return createError('UPLOAD_SIZE_MISMATCH', 'upload.size_mismatch', 400, msg);
  }

  if (msg.includes('Unknown uploadId')) {
    return createError('UPLOAD_UNKNOWN_ID', 'upload.unknown_id', 404, msg);
  }

  if (msg.includes('Not your upload')) {
    return createError('UPLOAD_NOT_YOURS', 'upload.not_yours', 403, msg);
  }

  if (msg.includes('corrupt') || msg.includes('metadata') && msg.includes('Failed to read')) {
    return createError('UPLOAD_CORRUPT_METADATA', 'upload.corrupt_metadata', 500, msg);
  }

  if (msg.includes('required')) {
    return createError('UPLOAD_MISSING_PARAMS', 'upload.missing_params', 400, msg);
  }

  if (msg.includes('must be a positive') || msg.includes('must be') || msg.includes('Invalid') || msg.includes('Empty')) {
    return createError('UPLOAD_INVALID_PARAMS', 'upload.invalid_params', 400, msg);
  }

  return createError('INTERNAL_ERROR', 'common.internal_error', 500, msg || 'Upload failed', msg);
}

// ── Direct error constructors for inline use in routes ──────────

export function uploadNoFileError() {
  return createError('UPLOAD_NO_FILE', 'upload.no_file', 400, 'No file was uploaded');
}

export function uploadMissingParamsError(details?: string) {
  return createError('UPLOAD_MISSING_PARAMS', 'upload.missing_params', 400, details || 'Missing required parameters');
}

export function uploadInvalidParamsError(details: string) {
  return createError('UPLOAD_INVALID_PARAMS', 'upload.invalid_params', 400, details);
}

export function uploadUnknownIdError() {
  return createError('UPLOAD_UNKNOWN_ID', 'upload.unknown_id', 404, 'Unknown uploadId — init first');
}

export function uploadNotYoursError() {
  return createError('UPLOAD_NOT_YOURS', 'upload.not_yours', 403, 'Not your upload');
}

export function uploadCorruptMetadataError() {
  return createError('UPLOAD_CORRUPT_METADATA', 'upload.corrupt_metadata', 500, 'Failed to read upload metadata');
}
