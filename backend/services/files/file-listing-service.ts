import {
  findByFilename,
  findRandomByUser,
  countByUser,
  listByUser,
  findOwnershipById,
  togglePublic,
  findForDelete,
  deleteById,
} from '../../repositories/file-repository.js';
import { deleteFromStorage } from '../../utils/index.js';
import { ERROR_CODES } from '../../errors/codes.js';

function buildTypeClause(type?: string): string {
  switch (type) {
    case 'audio':  return `AND mime_type LIKE 'audio/%'`;
    case 'video':  return `AND mime_type LIKE 'video/%'`;
    case 'image':  return `AND mime_type LIKE 'image/%'`;
    case 'file':   return `AND mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'audio/%' AND mime_type NOT LIKE 'video/%'`;
    default:       return '';
  }
}

export async function getFileByFilename(filename: string) {
  if (filename.includes('..') || filename.includes('/')) {
    throw Object.assign(new Error('Invalid filename'), { code: ERROR_CODES.FILE_INVALID_NAME });
  }
  const file = await findByFilename(filename);
  if (!file) {
    throw Object.assign(new Error('File not found'), { code: ERROR_CODES.FILE_NOT_FOUND });
  }
  return file;
}

export async function getRandomFile(userId: number, type?: string) {
  const typeClause = buildTypeClause(type);
  const file = await findRandomByUser(userId, typeClause);
  if (!file) {
    throw Object.assign(new Error('No files found'), { code: ERROR_CODES.FILE_NOT_FOUND });
  }
  return file;
}

export async function listUserFiles(userId: number, opts: {
  page: number;
  limit: number;
  search?: string;
  type?: string;
}) {
  const offset = (opts.page - 1) * opts.limit;
  const typeClause = buildTypeClause(opts.type);
  const [total, files] = await Promise.all([
    countByUser(userId, typeClause, opts.search),
    listByUser(userId, typeClause, opts.limit, offset, opts.search),
  ]);
  return {
    files,
    total,
    page: opts.page,
    totalPages: Math.ceil(total / opts.limit),
  };
}

export async function toggleFilePublic(fileId: number, userId: number, isPublic: boolean) {
  const file = await findOwnershipById(fileId);
  if (!file) {
    throw Object.assign(new Error('File not found'), { code: ERROR_CODES.FILE_NOT_FOUND });
  }
  if (row.user_id !== userId) {
    throw Object.assign(new Error('Not your file'), { code: ERROR_CODES.FILE_NOT_YOURS });
  }
  await togglePublic(fileId, isPublic);
  return { is_public: isPublic };
}

export async function deleteUserFile(fileId: number, userId: number) {
  const file = await findForDelete(fileId);
  if (!file) {
    throw Object.assign(new Error('File not found'), { statusCode: 404 });
  }
  if (file.user_id !== userId) {
    throw Object.assign(new Error('Not your file'), { statusCode: 403 });
  }
  try {
    await deleteFromStorage(file.path);
  } catch (err) {
    // Log but don't fail — file may already be gone from storage
    console.error('Storage delete failed:', (err as Error).message);
  }
  await deleteById(fileId);
}
