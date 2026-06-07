import { createError } from './error.factory.js';

export function backupNotFoundError() {
  return createError('BACKUP_NOT_FOUND', 'backup.not_found', 404, 'No backups found');
}

export function backupNoFileError() {
  return createError('BACKUP_NO_FILE', 'backup.no_file', 400, 'No file uploaded');
}
