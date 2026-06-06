import { dbAll, dbGet, dbRun } from '../db/index.js';

export interface FileRow {
  id: number;
  filename: string;
  original_name: string;
  path: string;
  size: number;
  mime_type: string;
  user_id: number | null;
  created_at: string;
  is_public: number;
  storage_backend: string;
  expires_at: string | null;
}

export interface FileServeRow {
  path: string;
  size: number;
  mime_type: string;
  is_public: number;
  user_id: number;
  storage_backend: string;
}

export interface FileOwnershipRow {
  user_id: number | null;
}

export interface FileDeleteRow {
  path: string;
  user_id: number | null;
  storage_backend: string;
}

/** Find a file by its unique filename (used for public serving). */
export async function findByFilename(filename: string): Promise<FileServeRow | undefined> {
  return dbGet<FileServeRow>(
    `SELECT path, size, mime_type, is_public, user_id, storage_backend
     FROM files WHERE filename = ?`,
    [filename]
  );
}

/** Find a random file for the given user, optionally filtered by type. */
export async function findRandomByUser(userId: number, typeClause: string): Promise<FileRow | undefined> {
  return dbGet<FileRow>(
    `SELECT * FROM files WHERE user_id = ? ${typeClause} ORDER BY RANDOM() LIMIT 1`,
    [userId]
  );
}

/** Count files for a user, with optional search and type filter. */
export async function countByUser(
  userId: number,
  typeClause: string,
  search?: string
): Promise<number> {
  const searchParam = search ? `%${search}%` : null;
  const sql = search
    ? `SELECT COUNT(*) AS total FROM files WHERE user_id = ? ${typeClause} AND (original_name LIKE ? OR filename LIKE ?)`
    : `SELECT COUNT(*) AS total FROM files WHERE user_id = ? ${typeClause}`;
  const params = searchParam ? [userId, searchParam, searchParam] : [userId];
  const row = await dbGet<{ total: number }>(sql, params);
  return row?.total ?? 0;
}

/** List files for a user, paginated, with optional search and type filter. */
export async function listByUser(
  userId: number,
  typeClause: string,
  limit: number,
  offset: number,
  search?: string
): Promise<FileRow[]> {
  const searchParam = search ? `%${search}%` : null;
  const sql = search
    ? `SELECT * FROM files WHERE user_id = ? ${typeClause} AND (original_name LIKE ? OR filename LIKE ?) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    : `SELECT * FROM files WHERE user_id = ? ${typeClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const params = searchParam
    ? [userId, searchParam, searchParam, limit, offset]
    : [userId, limit, offset];
  return dbAll<FileRow>(sql, params);
}

/** Find file owner by ID (for authorization checks). */
export async function findOwnershipById(id: number): Promise<FileOwnershipRow | undefined> {
  return dbGet<FileOwnershipRow>(
    `SELECT user_id FROM files WHERE id = ?`,
    [id]
  );
}

/** Toggle the public flag on a file. */
export async function togglePublic(id: number, isPublic: boolean): Promise<void> {
  await dbRun(
    `UPDATE files SET is_public = ? WHERE id = ?`,
    [isPublic ? 1 : 0, id]
  );
}

/** Get file path info needed for deletion (path + storage backend). */
export async function findForDelete(id: number): Promise<FileDeleteRow | undefined> {
  return dbGet<FileDeleteRow>(
    `SELECT path, user_id, storage_backend FROM files WHERE id = ?`,
    [id]
  );
}

/** Delete a file record by ID. */
export async function deleteById(id: number): Promise<void> {
  await dbRun(`DELETE FROM files WHERE id = ?`, [id]);
}

/** Get total storage used across all files. */
export async function getTotalUsed(): Promise<number> {
  const row = await dbGet<{ total: number }>(
    `SELECT COALESCE(SUM(size), 0) AS total FROM files`
  );
  return row?.total ?? 0;
}

/** Get storage used by a specific user. */
export async function getUsedByUser(userId: number): Promise<number> {
  const row = await dbGet<{ used: number }>(
    `SELECT COALESCE(SUM(size), 0) AS used FROM files WHERE user_id = ?`,
    [userId]
  );
  return row?.used ?? 0;
}

/** Insert a new file record. Returns the new row ID. */
export async function insertFile(params: {
  filename: string;
  originalName: string;
  storageKey: string;
  size: number;
  mimeType: string;
  userId: number | null;
  createdAt: string;
  expiresAt: string | null;
  backend: string;
}): Promise<number> {
  const r = await dbRun(
    `INSERT INTO files (filename, original_name, path, size, mime_type, user_id, created_at, expires_at, storage_backend)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.filename,
      params.originalName,
      params.storageKey,
      params.size,
      params.mimeType,
      params.userId,
      params.createdAt,
      params.expiresAt,
      params.backend,
    ]
  );
  return r.lastID;
}

/** Find all file paths and storage backends for a user (used for cleanup). */
export async function findFilePathsByUserId(
  userId: number
): Promise<{ path: string; storage_backend: string }[]> {
  return dbAll<{ path: string; storage_backend: string }>(
    `SELECT path, storage_backend FROM files WHERE user_id = ?`,
    [userId]
  );
}

/** Delete all file records for a user. */
export async function deleteFilesByUserId(userId: number): Promise<number> {
  const r = await dbRun(`DELETE FROM files WHERE user_id = ?`, [userId]);
  return r.changes;
}

/** Re-insert a full file row (used by undo). */
export async function reInsertFile(row: Record<string, unknown>): Promise<void> {
  await dbRun(
    `INSERT INTO files (id, filename, original_name, path, size, mime_type, user_id, created_at, is_public, storage_backend)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.filename, row.original_name, row.path, row.size,
      row.mime_type, row.user_id, row.created_at, row.is_public, row.storage_backend,
    ]
  );
}

/** Find all expired files (for cleanup job). */
export interface ExpiredFileRow {
  id: number;
  path: string;
  storage_backend: string;
}

export async function findExpiredFiles(): Promise<ExpiredFileRow[]> {
  return dbAll<ExpiredFileRow>(
    `SELECT id, path, storage_backend FROM files
     WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`
  );
}

/** Delete a single file record by ID. Returns number of deleted rows. */
export async function deleteFileRowById(id: number): Promise<number> {
  const r = await dbRun(`DELETE FROM files WHERE id = ?`, [id]);
  return r.changes;
}

/** Update a file's path and user_id (used by migration undo). */
export async function updateFilePathAndUser(
  oldPath: string,
  newPath: string,
  newUserId: number
): Promise<void> {
  await dbRun(
    `UPDATE files SET path = ?, user_id = ? WHERE path = ?`,
    [newPath, newUserId, oldPath]
  );
}

/** Find all files for a user NOT stored on the given backend. */
export interface MigrationFileRow {
  id: number;
  filename: string;
  original_name: string;
  path: string;
  size: number;
  mime_type: string;
  storage_backend: string;
}

export async function findFilesNotOnBackend(
  userId: number,
  backend: string
): Promise<MigrationFileRow[]> {
  return dbAll<MigrationFileRow>(
    `SELECT id, filename, original_name, path, size, mime_type, storage_backend
     FROM files WHERE user_id = ? AND storage_backend != ?`,
    [userId, backend]
  );
}

/** Update a single file's path and backend. */
export async function updateFileBackendAndPath(
  id: number,
  newPath: string,
  newBackend: string
): Promise<void> {
  await dbRun(
    `UPDATE files SET path = ?, storage_backend = ? WHERE id = ?`,
    [newPath, newBackend, id]
  );
}
