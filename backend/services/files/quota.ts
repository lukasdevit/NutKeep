import { getTotalUsed, getUsedByUser } from '../../repositories/file-repository.js';
import { getStorageLimit } from '../../repositories/user-repository.js';
import { getTotalStorageLimit } from '../../config/index.js';
import { formatBytes } from '../../utils/index.js';
import { ERROR_CODES } from '../../errors/codes.js';

/**
 * Check both global and per-user storage quota before uploading.
 * Call this BEFORE writing the file to permanent storage.
 */
export async function checkStorageQuota(
  size: number,
  userId?: number
): Promise<void> {
  const totalLimit = await getTotalStorageLimit();
  if (totalLimit > 0) {
    const total = await getTotalUsed();
    if (total + size > totalLimit) {
      throw Object.assign(
        new Error('Server storage limit reached. Contact the administrator.'),
        { code: ERROR_CODES.UPLOAD_QUOTA_SERVER }
      );
    }
  }

  if (userId !== undefined) {
    const quota = await getUserQuota(userId);
    if (quota.used + size > quota.limit) {
      throw Object.assign(
        new Error(
          `Storage quota exceeded. You've used ${formatBytes(quota.used)} of ${formatBytes(quota.limit)}.`
        ),
        { code: ERROR_CODES.UPLOAD_QUOTA_USER }
      );
    }
  }
}

async function getUserQuota(
  userId: number
): Promise<{ used: number; limit: number }> {
  const [used, limit] = await Promise.all([
    getUsedByUser(userId),
    getStorageLimit(userId),
  ]);
  return { used, limit };
}
