import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../../app.js';
import { closeDb, dbRun } from '../../db/index.js';
import { clearConfigCache } from '../../config/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  request = supertest(app.server);
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('POST /upload', () => {
  it('rejects unauthenticated uploads', async () => {
    const res = await request.post('/upload').expect(401);

    expect(res.body.message).toContain('Missing token');
  });
});

describe('POST /sharex/upload (removed — merged into /upload)', () => {
  it('returns 404 (route no longer exists)', async () => {
    const res = await request.post('/sharex/upload');

    expect(res.status).toBe(404);
  });
});

describe('GET /sharex/config', () => {
  let token: string;

  beforeAll(async () => {
    const r = await request
      .post('/auth/register')
      .send({ username: 'sharexuser', password: 'testpass123' });
    token = r.body.token;
  });

  it('returns a ShareX config file for authenticated user', async () => {
    const res = await request
      .get('/sharex/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('Name');
    expect(res.body).toHaveProperty('DestinationType');
    expect(res.body.RequestURL).toContain('/upload');
  });
});

describe('Global storage limit (507)', () => {
  let token: string;

  beforeAll(async () => {
    const r = await request
      .post('/auth/register')
      .send({ username: 'storagelimiter', password: 'testpass123' });
    token = r.body.token;

    // Set global storage limit to 1 byte (effectively blocks all uploads)
    await dbRun(
      `INSERT INTO settings (key, value) VALUES ('total_storage_limit', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
  });

  afterAll(async () => {
    await dbRun(`DELETE FROM settings WHERE key = 'total_storage_limit'`);
  });

  it('rejects upload when global storage limit is exceeded', async () => {
    const tmpFile = path.join('/tmp', 'linqoy-test-small.txt');
    fs.writeFileSync(tmpFile, Buffer.alloc(100));

    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tmpFile)
      .expect(507);

    expect(res.body.message).toContain('Server storage limit');
    fs.unlinkSync(tmpFile);
  });
});

describe('Global max file size (413)', () => {
  let token: string;

  beforeAll(async () => {
    const r = await request
      .post('/auth/register')
      .send({ username: 'maxfilesizeuser', password: 'testpass123' });
    token = r.body.token;

    // Ensure total_storage_limit doesn't interfere (clear leftover from other tests)
    await dbRun(`DELETE FROM settings WHERE key = 'total_storage_limit'`);

    // Set global max_file_size to 100 bytes
    await dbRun(
      `INSERT INTO settings (key, value) VALUES ('max_file_size', '100') ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    clearConfigCache();
  });

  afterAll(async () => {
    await dbRun(`DELETE FROM settings WHERE key = 'max_file_size'`);
  });

  it('rejects upload exceeding global max_file_size', async () => {
    const tmpFile = path.join('/tmp', 'linqoy-test-too-large.txt');
    fs.writeFileSync(tmpFile, Buffer.alloc(200));

    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tmpFile)
      .expect(413);

    expect(res.body.message).toContain('File too large');
    fs.unlinkSync(tmpFile);
  });

  it('allows upload within global max_file_size', async () => {
    // Set limit high enough to accept this file
    await dbRun(
      `INSERT INTO settings (key, value) VALUES ('max_file_size', '500') ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    clearConfigCache();

    const tmpFile = path.join('/tmp', 'linqoy-test-small-ok.txt');
    fs.writeFileSync(tmpFile, Buffer.alloc(200));

    // Should pass size check (may fail on other checks like scan, but not 413)
    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tmpFile);

    // 413 = file too large, anything else = passed size check
    expect(res.status).not.toBe(413);
    fs.unlinkSync(tmpFile);
  });
});

describe('Per-user max file size override', () => {
  let token: string;
  let uid: number;

  beforeAll(async () => {
    const r = await request
      .post('/auth/register')
      .send({ username: 'perusersize', password: 'testpass123' });
    token = r.body.token;
    uid = r.body.user.id;

    // Clear any leftover limits
    await dbRun(`DELETE FROM settings WHERE key = 'total_storage_limit'`);

    // Set global max_file_size to 1 MB (generous)
    await dbRun(
      `INSERT INTO settings (key, value) VALUES ('max_file_size', '1048576') ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    // Set per-user max_file_size to 50 bytes (very restrictive)
    await dbRun(
      `UPDATE users SET max_file_size = 50 WHERE id = ?`,
      [uid]
    );
    clearConfigCache();
  });

  afterAll(async () => {
    await dbRun(`DELETE FROM settings WHERE key = 'max_file_size'`);
  });

  it('rejects upload exceeding per-user max_file_size (overrides global)', async () => {
    const tmpFile = path.join('/tmp', 'linqoy-test-peruser-large.txt');
    fs.writeFileSync(tmpFile, Buffer.alloc(100));

    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tmpFile)
      .expect(413);

    expect(res.body.message).toContain('File too large');
    fs.unlinkSync(tmpFile);
  });

  it('allows upload within per-user max_file_size', async () => {
    const tmpFile = path.join('/tmp', 'linqoy-test-peruser-small.txt');
    fs.writeFileSync(tmpFile, Buffer.alloc(30));

    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tmpFile);

    // Should not be rejected for file size
    expect(res.status).not.toBe(413);
    fs.unlinkSync(tmpFile);
  });
});
