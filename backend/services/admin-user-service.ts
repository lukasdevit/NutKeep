import bcrypt from 'bcrypt';
import { DEFAULT_STORAGE_LIMIT } from './../config/index.js';
import { recordAction } from './action-log-service.js';
import {
  insertUser,
  countUsersFiltered,
  listUsersWithStats,
  updateUser,
  unlockUser,
  deleteUser,
} from './../repositories/user-repository.js';
import {
  findFilePathsByUserId,
  deleteFilesByUserId,
} from './../repositories/file-repository.js';
import { getStorage } from './storage/index.js';

const BCRYPT_ROUNDS = 10;

export async function createUser(params: {
  username: string;
  password: string;
  isAdmin?: boolean;
  storageLimit?: number;
  maxFileSize?: number | null;
}, adminUsername?: string) {
  const hash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);
  const limit = params.storageLimit && params.storageLimit > 0
    ? params.storageLimit
    : DEFAULT_STORAGE_LIMIT;

  try {
    const id = await insertUser({
      username: params.username,
      passwordHash: hash,
      storageLimit: limit,
      ...(params.maxFileSize !== undefined ? { maxFileSize: params.maxFileSize } : {}),
      isAdmin: !!params.isAdmin,
    });
    if (adminUsername) {
      await recordAction(
        adminUsername,
        'user-create',
        `Created user: ${params.username}`,
        { userId: id, username: params.username, isAdmin: !!params.isAdmin }
      );
    }
    return { id, username: params.username, is_admin: !!params.isAdmin, storage_limit: limit };
  } catch (err) {
    if ((err as Error).message.includes('UNIQUE')) {
      throw Object.assign(new Error('Username already taken'), { code: 'DUPLICATE_USERNAME' });
    }
    throw err;
  }
}

export async function listUsers(search?: string) {
  const [total, users] = await Promise.all([
    countUsersFiltered(search),
    listUsersWithStats(50, 0, search),
  ]);
  return { users, total, page: 1, totalPages: Math.ceil(total / 50) };
}

export async function listUsersPaginated(opts: {
  page: number;
  limit: number;
  search?: string;
}) {
  const offset = (opts.page - 1) * opts.limit;
  const [total, users] = await Promise.all([
    countUsersFiltered(opts.search),
    listUsersWithStats(opts.limit, offset, opts.search),
  ]);
  return { users, total, page: opts.page, totalPages: Math.ceil(total / opts.limit) };
}

export async function editUser(userId: number, changes: {
  storageLimit?: number;
  maxFileSize?: number | null;
  isAdmin?: boolean;
  newPassword?: string;
}, adminUsername?: string) {
  const passwordHash = changes.newPassword
    ? await bcrypt.hash(changes.newPassword, BCRYPT_ROUNDS)
    : undefined;

  const result = await updateUser(userId, {
    ...(changes.storageLimit !== undefined ? { storageLimit: changes.storageLimit } : {}),
    ...(changes.maxFileSize !== undefined ? { maxFileSize: changes.maxFileSize } : {}),
    ...(changes.isAdmin !== undefined ? { isAdmin: changes.isAdmin } : {}),
    ...(passwordHash !== undefined ? { passwordHash } : {}),
  });

  if (result === 0) {
    throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
  }

  if (adminUsername) {
    const changed: Record<string, unknown> = {};
    if (changes.storageLimit !== undefined) changed.storage_limit = changes.storageLimit;
    if (changes.isAdmin !== undefined) changed.is_admin = changes.isAdmin;
    if (changes.newPassword !== undefined) changed.password_changed = true;
    await recordAction(
      adminUsername,
      'user-edit',
      `Edited user #${userId}`,
      { userId, changes: changed }
    );
  }
}

export async function unlockUserAccount(userId: number) {
  const changes = await unlockUser(userId);
  if (changes === 0) {
    throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
  }
}

export async function removeUser(userId: number, adminId: number, adminUsername?: string) {
  if (userId === adminId) {
    throw Object.assign(new Error('Cannot delete yourself'), { code: 'SELF_DELETE' });
  }

  const storage = await getStorage();
  const files = await findFilePathsByUserId(userId);
  for (const f of files) {
    try {
      await storage.delete(f.path);
    } catch (err) {
      console.error('Storage delete failed:', (err as Error).message);
    }
  }
  await deleteFilesByUserId(userId);
  const changes = await deleteUser(userId);
  if (changes === 0) {
    throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
  }
  if (adminUsername) {
    await recordAction(
      adminUsername,
      'user-delete',
      `Deleted user #${userId}`,
      { userId, filesDeleted: files.length }
    );
  }
  return { files_deleted: files.length };
}
