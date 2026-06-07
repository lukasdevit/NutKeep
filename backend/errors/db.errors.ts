import { createError } from './error.factory.js';

export function dbInvalidTableError() {
  return createError('DB_INVALID_TABLE', 'db.invalid_table', 400, 'Invalid table name');
}

export function dbLastAdminError() {
  return createError('DB_LAST_ADMIN', 'db.last_admin', 403, 'Cannot delete the last admin user');
}
