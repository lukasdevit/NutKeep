import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../../app.js';
import { closeDb, dbRun } from '../../db/index.js';
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

    expect(res.body.error).toContain('Missing token');
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

    expect(res.body.error).toContain('Server storage limit');
    fs.unlinkSync(tmpFile);
  });
});
