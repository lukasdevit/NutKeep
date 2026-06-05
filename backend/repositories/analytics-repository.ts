import { dbAll, dbGet } from '../db/index.js';

export interface DailyPoint {
  day: string;
  count: number;
  bytes: number;
}

export interface TopUser {
  username: string;
  files: number;
  bytes: number;
}

export interface Category {
  category: string;
  count: number;
  bytes: number;
}

/** Total file count and bytes across all files. */
export async function getFileTotals(): Promise<{ files: number; bytes: number }> {
  const row = await dbGet<{ files: number; bytes: number }>(
    `SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes FROM files`
  );
  return { files: row?.files ?? 0, bytes: row?.bytes ?? 0 };
}

/** Count files uploaded today. */
export async function countFilesSince(cutoff: string): Promise<number> {
  const row = await dbGet<{ today: number }>(
    `SELECT COUNT(*) AS today FROM files WHERE created_at >= ?`,
    [cutoff]
  );
  return row?.today ?? 0;
}

/** Daily upload stats for the last N days. */
export async function getDailyStats(since: string): Promise<DailyPoint[]> {
  return dbAll<DailyPoint>(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes
     FROM files WHERE created_at >= ? GROUP BY day ORDER BY day`,
    [since]
  );
}

/** Top 10 users by total bytes uploaded. */
export async function getTopUsers(): Promise<TopUser[]> {
  return dbAll<TopUser>(
    `SELECT u.username, COUNT(f.id) AS files, COALESCE(SUM(f.size), 0) AS bytes
     FROM users u LEFT JOIN files f ON f.user_id = u.id
     GROUP BY u.id ORDER BY bytes DESC LIMIT 10`
  );
}

/** File count and bytes grouped by MIME type category. */
export async function getFileCategories(): Promise<Category[]> {
  return dbAll<Category>(
    `SELECT CASE
       WHEN mime_type LIKE 'image/%' THEN 'Images'
       WHEN mime_type LIKE 'video/%' THEN 'Videos'
       WHEN mime_type LIKE 'audio/%' THEN 'Audio'
       WHEN mime_type LIKE 'text/%' OR mime_type IN ('application/json','application/xml','application/javascript') THEN 'Text / Code'
       ELSE 'Other'
     END AS category, COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes
     FROM files GROUP BY category ORDER BY bytes DESC`
  );
}
