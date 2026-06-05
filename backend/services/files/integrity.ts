import path from 'path';
import { DEFAULT_UPLOAD_DIR } from '../../config/index.js';
import { LocalStorage } from '../storage/local.js';
import { B2Storage } from '../storage/b2/index.js';
import { R2Storage } from '../storage/r2/index.js';
import type { StorageProvider } from '../storage/types.js';
import { recordAction } from '../action-log-service.js';
import {
  insertCheck,
  insertIssues,
  findIssue,
  resolveIssue as markIssueResolved,
  getFilesForScan,
  getFileRow,
  deleteFileRow,
  findOrphanedIssue,
} from '../../repositories/integrity-repository.js';
import { insertFile, updateFilePathAndUser } from '../../repositories/file-repository.js';
import { findByUsername, findById } from '../../repositories/user-repository.js';
import {
  scanDirectory,
  toRelativePath,
  extractUsernameFromPath,
  getMimeType,
  cleanEmptyDirs,
  statFile,
  moveFile,
} from './adapter.js';

const local: StorageProvider = new LocalStorage();
// Cloud providers are lazily created only when needed

function getCloudProvider(backend: string): StorageProvider | null {
  try {
    if (backend === 'b2') return new B2Storage();
    if (backend === 'r2') return new R2Storage();
    return null;
  } catch {
    return null;
  }
}

export async function runIntegrityCheck(
  userId?: number
): Promise<{ checkId: string; total: number; summary: { missingFiles: number; orphanedFiles: number; sizeMismatches: number } }> {
  const dbFiles = await getFilesForScan(userId);

  const localDbFiles = dbFiles.filter((f) => f.storage_backend === 'local' || !f.storage_backend);
  const cloudDbFiles = dbFiles.filter((f) => f.storage_backend !== 'local' && f.storage_backend);

  const dbByPath = new Map<string, (typeof dbFiles)[0]>();
  for (const f of localDbFiles) dbByPath.set(toRelativePath(f.path), f);

  const diskFiles = new Map<string, string>();
  const scanDir = userId
    ? path.join(DEFAULT_UPLOAD_DIR, 'share', String(userId))
    : path.join(DEFAULT_UPLOAD_DIR, 'share');
  scanDirectory(scanDir, DEFAULT_UPLOAD_DIR, diskFiles);

  const insertRows: (string | number | null)[][] = [];

  for (const [relPath, dbFile] of dbByPath) {
    const absPath = path.join(DEFAULT_UPLOAD_DIR, relPath);
    const stat = statFile(absPath);
    if (!stat) {
      insertRows.push(['missing-file', dbFile.id, dbFile.filename, dbFile.original_name, dbFile.user_id, null, dbFile.size, null]);
    } else if (stat.size !== dbFile.size) {
      insertRows.push(['size-mismatch', dbFile.id, dbFile.filename, dbFile.original_name, dbFile.user_id, relPath, dbFile.size, stat.size]);
    }
  }

  if (cloudDbFiles.length > 0) {
    for (const dbFile of cloudDbFiles) {
      const provider = getCloudProvider(dbFile.storage_backend);
      if (!provider) continue;
      try {
        const cloudSize = await provider.size(dbFile.path);
        if (cloudSize !== dbFile.size) {
          insertRows.push(['size-mismatch', dbFile.id, dbFile.filename, dbFile.original_name, dbFile.user_id, dbFile.path, dbFile.size, cloudSize]);
        }
      } catch {
        insertRows.push(['missing-file', dbFile.id, dbFile.filename, dbFile.original_name, dbFile.user_id, null, dbFile.size, null]);
      }
    }
  }

  for (const [relPath] of diskFiles) {
    if (!dbByPath.has(relPath)) {
      insertRows.push(['orphaned-file', null, null, null, null, relPath, null, null]);
    }
  }

  const checkId = `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const missingFiles = insertRows.filter((r) => r[0] === 'missing-file').length;
  const orphanedFiles = insertRows.filter((r) => r[0] === 'orphaned-file').length;
  const sizeMismatches = insertRows.filter((r) => r[0] === 'size-mismatch').length;

  await insertCheck({ checkId, totalIssues: insertRows.length, missingFiles, orphanedFiles, sizeMismatches });
  await insertIssues(checkId, insertRows);

  return { checkId, total: insertRows.length, summary: { missingFiles, orphanedFiles, sizeMismatches } };
}

export async function resolveSingleIssue(
  checkId: string,
  issueId: number,
  action: string,
  username?: string
): Promise<void> {
  const issue = await findIssue(checkId, issueId);
  if (!issue) throw Object.assign(new Error('Issue not found'), { statusCode: 404 });
  if (issue.resolved) throw Object.assign(new Error('Already resolved'), { statusCode: 409 });

  if (action === 'delete-db' && issue.file_id) {
    const row = await getFileRow(issue.file_id);
    await deleteFileRow(issue.file_id);
    if (username && row) {
      await recordAction(username, 'delete-db', `Deleted file row #${issue.file_id}`, row as Record<string, unknown>);
    }
  } else if (action === 'delete-file' && issue.disk_path) {
    await local.delete(issue.disk_path).catch(() => {});
    const absPath = path.join(DEFAULT_UPLOAD_DIR, issue.disk_path);
    cleanEmptyDirs(absPath);
    if (username) {
      await recordAction(username, 'delete-file', `Deleted file: ${issue.disk_path}`, { diskPath: issue.disk_path });
    }
  }

  await markIssueResolved(issueId, action);
}

export async function importOrphanedFiles(
  checkId: string,
  issueIds: number[],
  username?: string,
  userId?: number,
  originalName?: string
): Promise<{ issueId: number; fileId: number }[]> {
  const imported: { issueId: number; fileId: number }[] = [];

  for (const issueId of issueIds) {
    const issue = await findOrphanedIssue(checkId, issueId);
    if (!issue || issue.resolved) continue;

    const absPath = path.join(DEFAULT_UPLOAD_DIR, issue.disk_path);
    const stat = statFile(absPath);
    if (!stat) continue;

    const diskName = path.basename(issue.disk_path);
    const ext = path.extname(diskName);
    const base = path.basename(diskName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const filename = `${base}-${Date.now().toString(36)}${ext}`;
    const resolvedUsername = extractUsernameFromPath(issue.disk_path);
    let resolvedUserId = userId ?? null;
    if (!resolvedUserId && resolvedUsername) {
      const userRow = await findByUsername(resolvedUsername);
      resolvedUserId = userRow?.id ?? null;
    }
    const nameForDb = originalName || diskName;

    const fileId = await insertFile({
      filename,
      originalName: nameForDb,
      storageKey: absPath,
      size: stat.size,
      mimeType: getMimeType(diskName),
      userId: resolvedUserId ?? null,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      backend: 'local',
    });

    await markIssueResolved(issueId, 'imported');
    imported.push({ issueId, fileId });

    if (username) {
      await recordAction(username, 'import', `Imported orphaned file: ${diskName} (new ID #${fileId})`, {
        fileId, filename, originalName: nameForDb,
      });
    }
  }

  return imported;
}

export async function migrateFile(
  relPath: string,
  toUserId: number,
  username?: string
): Promise<string> {
  const absSrc = path.join(DEFAULT_UPLOAD_DIR, relPath);
  if (!statFile(absSrc)) throw new Error('File not found');

  const fromUsername = extractUsernameFromPath(relPath);
  if (!fromUsername) throw new Error('Could not determine source user');
  const fromUserRow = await findByUsername(fromUsername);
  if (!fromUserRow) throw new Error('Source user not found');
  if (fromUserRow.id === toUserId) throw new Error('Already belongs to target user');

  const toUserRow = await findById(toUserId);
  if (!toUserRow) throw new Error('Target user not found');

  const parts = relPath.split(path.sep);
  parts[0] = toUserRow.username;
  const destRel = parts.join(path.sep);
  const absDest = path.join(DEFAULT_UPLOAD_DIR, destRel);

  moveFile(absSrc, absDest);
  await updateFilePathAndUser(absSrc, absDest, toUserId);

  if (username) {
    await recordAction(username, 'migrate', `Migrated file: ${relPath} → user #${toUserId}`, {
      fromPath: absSrc, toPath: absDest, fromUser: fromUsername,
    });
  }

  return `${relPath} → ${destRel}`;
}
