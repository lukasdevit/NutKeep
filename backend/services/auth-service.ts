import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import {
  findByUsername,
  insertUser,
  updateFailedLogins,
  resetFailedLogins,
  findById,
  updatePassword,
  getStorageLimit,
  countDemoUsersSince,
  deleteDemoUser,
} from '../repositories/user-repository.js';
import {
  findFilePathsByUserId,
  deleteFilesByUserId,
  getUsedByUser,
} from '../repositories/file-repository.js';
import { getSetting } from '../repositories/settings-repository.js';
import { deleteFromStorage } from '../utils/index.js';
import {
  DEFAULT_STORAGE_LIMIT,
  DEMO_STORAGE_LIMIT,
  MAX_FAILED_LOGINS,
  LOCKOUT_MINUTES,
  DEMO_GLOBAL_RATE_LIMIT,
  DEMO_RATE_WINDOW_MS,
} from '../config/index.js';
import { ERROR_CODES } from '../errors/codes.js';

const BCRYPT_ROUNDS = 10;

const DEMO_ADJECTIVES = [
  'Sleepy', 'Grumpy', 'Sassy', 'Wobbly', 'Funky', 'Cheeky', 'Bouncy',
  'Zigzag', 'Noodle', 'Pickle', 'Waffle', 'Squishy', 'Giggly', 'Dizzy',
  'Snazzy', 'Goofy', 'Loopy', 'Jolly', 'Zippy', 'Cranky',
];

const DEMO_NOUNS = [
  'Raccoon', 'Banana', 'Sloth', 'Penguin', 'Taco', 'Muffin', 'Potato',
  'Duck', 'Llama', 'Wombat', 'Narwhal', 'Koala', 'Hamster', 'Badger',
  'Ferret', 'Walrus', 'Otter', 'Corgi', 'Axolotl', 'Capybara',
];

interface RegisterResult {
  id: number;
  username: string;
  isAdmin: boolean;
  isDemo: boolean;
}

/** Register a new user. Throws on duplicate username or if registrations are closed. */
export async function registerUser(
  username: string,
  password: string,
  isTest = false
): Promise<RegisterResult> {
  if (!isTest) {
    const regOpen = await getSetting('registrations_open');
    if (regOpen === 'false') {
      throw Object.assign(new Error('Registrations are currently disabled'), { code: ERROR_CODES.AUTH_REGISTRATIONS_DISABLED });
    }
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const id = await insertUser({
      username,
      passwordHash: hash,
      storageLimit: DEFAULT_STORAGE_LIMIT,
    });
    return { id, username, isAdmin: false, isDemo: false };
  } catch (err) {
    if ((err as Error).message.includes('UNIQUE')) {
      throw Object.assign(new Error('Username already taken'), { code: ERROR_CODES.AUTH_USERNAME_TAKEN });
    }
    throw err;
  }
}

interface LoginResult {
  id: number;
  username: string;
  isAdmin: boolean;
}

/** Authenticate a user. Returns user info or throws with appropriate error. */
export async function loginUser(
  username: string,
  password: string
): Promise<LoginResult> {
  const row = await findByUsername(username);
  if (!row) {
    throw Object.assign(new Error('Invalid credentials'), { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS });
  }

  // Check lockout
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const remaining = Math.ceil(
      (new Date(row.locked_until).getTime() - Date.now()) / 60000
    );
    throw Object.assign(
      new Error(`Account locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`),
        { code: ERROR_CODES.AUTH_ACCOUNT_LOCKED }
    );
  }

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    const newCount = row.failed_logins + 1;
    const lockedUntil =
      newCount >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null;
    await updateFailedLogins(row.id, newCount, lockedUntil);

    const attemptsLeft = MAX_FAILED_LOGINS - newCount;
    const msg =
      attemptsLeft > 0
        ? `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`
        : `Account locked for ${LOCKOUT_MINUTES} minutes.`;
    throw Object.assign(new Error(msg), { code: ERROR_CODES.AUTH_INVALID_CREDENTIALS });
  }

  await resetFailedLogins(row.id);
  return { id: row.id, username: row.username, isAdmin: row.is_admin === 1 };
}

/** Change a user's password. Throws if current password is incorrect. */
export async function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await findById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: ERROR_CODES.AUTH_USER_NOT_FOUND });
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    throw Object.assign(new Error('Current password is incorrect'), { code: ERROR_CODES.AUTH_WRONG_PASSWORD });
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updatePassword(userId, hash);
}

interface StorageInfo {
  used: number;
  limit: number;
  s3_upload_enabled: boolean;
}

/** Get storage usage info for a user. */
export async function getUserStorageInfo(userId: number): Promise<StorageInfo> {
  const [used, limit, s3Enabled] = await Promise.all([
    getUsedByUser(userId),
    getStorageLimit(userId),
    getSetting('s3_upload_enabled'),
  ]);
  return { used, limit, s3_upload_enabled: s3Enabled === 'true' };
}

interface DemoResult {
  id: number;
  username: string;
  isAdmin: boolean;
  isDemo: boolean;
  password: string;
}

/** Create a demo account. Throws if demo registrations are disabled or rate-limited. */
export async function createDemoAccount(isTest = false): Promise<DemoResult> {
  if (!isTest) {
    const demoOpen = await getSetting('demo_registrations_open');
    if (demoOpen === 'false') {
      throw Object.assign(new Error('Demo accounts are currently disabled'), { code: ERROR_CODES.AUTH_REGISTRATIONS_DISABLED });
    }

    const cutoff = new Date(Date.now() - DEMO_RATE_WINDOW_MS).toISOString();
    const globalCount = await countDemoUsersSince(cutoff);
    if (globalCount >= DEMO_GLOBAL_RATE_LIMIT) {
      throw Object.assign(
        new Error('Too many demo accounts created. Try again shortly.'),
        { code: ERROR_CODES.AUTH_DEMO_LIMIT_REACHED }
      );
    }
  }

  const adj = DEMO_ADJECTIVES[Math.floor(Math.random() * DEMO_ADJECTIVES.length)]!;
  const noun = DEMO_NOUNS[Math.floor(Math.random() * DEMO_NOUNS.length)]!;
  const username = `${adj}${noun}_${nanoid(6)}`;
  const password = crypto.randomBytes(12).toString('hex');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const id = await insertUser({
      username,
      passwordHash: hash,
      storageLimit: DEMO_STORAGE_LIMIT,
      isDemo: true,
    });
    return { id, username, isAdmin: false, isDemo: true, password };
  } catch {
    throw Object.assign(new Error('Failed to create demo account'), { code: ERROR_CODES.INTERNAL_ERROR });
  }
}

/** Clean up a demo session: delete all files from storage and DB, then delete the user. */
export async function cleanupDemoSession(userId: number): Promise<void> {
  const files = await findFilePathsByUserId(userId);
  for (const f of files) {
    await deleteFromStorage(f.path).catch(() => {});
  }
  await deleteFilesByUserId(userId);
  await deleteDemoUser(userId);
}
