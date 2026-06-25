import { db } from './connection.js';
import { DEFAULT_STORAGE_LIMIT } from '../config/index.js';

/** Initialize all database tables. CREATE TABLE IF NOT EXISTS is idempotent. */
export function initSchema(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        user_id INTEGER,
        created_at TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 1,
        expires_at TEXT,
        storage_backend TEXT NOT NULL DEFAULT 'local'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        storage_limit INTEGER NOT NULL DEFAULT ${DEFAULT_STORAGE_LIMIT},
        max_file_size INTEGER,
        is_admin INTEGER NOT NULL DEFAULT 0,
        failed_logins INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        destination TEXT NOT NULL,
        status TEXT NOT NULL,
        size_bytes INTEGER,
        error TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS integrity_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        check_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        total_issues INTEGER NOT NULL DEFAULT 0,
        missing_files INTEGER NOT NULL DEFAULT 0,
        orphaned_files INTEGER NOT NULL DEFAULT 0,
        size_mismatches INTEGER NOT NULL DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS integrity_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        check_id TEXT NOT NULL,
        type TEXT NOT NULL,
        file_id INTEGER,
        filename TEXT,
        original_name TEXT,
        user_id INTEGER,
        disk_path TEXT,
        db_size INTEGER,
        disk_size INTEGER,
        resolved INTEGER NOT NULL DEFAULT 0,
        action_taken TEXT,
        FOREIGN KEY (check_id) REFERENCES integrity_checks(check_id)
      )
    `);

    db.run(
      `
      CREATE TABLE IF NOT EXISTS admin_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        undo_data TEXT,
        undone INTEGER NOT NULL DEFAULT 0
      )
    `,
      (err) => {
        if (err) reject(err);
        else {
          // ── Migrations for existing databases ──
          // Add max_file_size column if it doesn't exist (safe to run on new DBs too)
          db.run(
            `ALTER TABLE users ADD COLUMN max_file_size INTEGER`,
            (alterErr) => {
              // Ignore "duplicate column" errors — column already exists
              if (alterErr && !alterErr.message.includes('duplicate column')) {
                console.warn('Migration warning (max_file_size):', alterErr.message);
              }
              resolve();
            }
          );
        }
      }
    );
  });
}
