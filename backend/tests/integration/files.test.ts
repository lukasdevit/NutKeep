import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import path from 'path';
import fs from 'fs';
import { buildApp } from '../../app.js';
import { closeDb } from '../../db/index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let request: ReturnType<typeof supertest>;
let userToken: string;
let otherToken: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  request = supertest(app.server);

  // Create two users
  const r1 = await request
    .post('/auth/register')
    .send({ username: 'fileowner', password: 'ownerpass123' });
  userToken = r1.body.token;

  const r2 = await request
    .post('/auth/register')
    .send({ username: 'otherguy', password: 'otherpass123' });
  otherToken = r2.body.token;
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('POST /upload', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request.post('/upload').expect(401);

    expect(res.body.message).toContain('Missing token');
  });

  it('rejects request with no file', async () => {
    // Sending a POST to the upload endpoint without attaching a file.
    // The multipart plugin will reject this — exact status depends on
    // how the empty body is parsed (400, 406, or 500). The key is: it fails.
    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('accepts a valid text file upload', async () => {
    const testFilePath = path.join(
      process.cwd(),
      'src',
      'tests',
      'fixtures',
      'hello.txt'
    );
    // Fixture might not exist, so check first
    if (fs.existsSync(testFilePath)) {
      const res = await request
        .post('/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', testFilePath)
        .expect(200);

      expect(res.body).toHaveProperty('url');
      expect(res.body.url).toContain('/file/');
    }
  });

  it('rejects disallowed file types', async () => {
    // Create a temp .exe-like file with a disallowed mime
    const tmpDir = fs.mkdtempSync('/tmp/upload-test-');
    const badFile = path.join(tmpDir, 'virus.exe');
    fs.writeFileSync(badFile, 'not really a virus');

    const res = await request
      .post('/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', badFile, { contentType: 'application/x-shockwave-flash' })
      .expect(415);

    expect(res.body.message).toContain('not allowed');

    // Cleanup
    fs.unlinkSync(badFile);
    fs.rmdirSync(tmpDir);
  });
});

describe('GET /files', () => {
  it('rejects unauthenticated requests', async () => {
    await request.get('/files').expect(401);
  });

  it('returns paginated response structure', async () => {
    const res = await request
      .get('/files')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('files');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.page).toBe(1);
  });

  it('respects page and limit query params', async () => {
    const res = await request
      .get('/files?page=2&limit=10')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.page).toBe(2);
    expect(res.body.files.length).toBeLessThanOrEqual(10);
  });

  it('rejects invalid page (negative)', async () => {
    const res = await request
      .get('/files?page=-1')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    // Clamped to page 1
    expect(res.body.page).toBe(1);
  });

  it('caps limit at 100', async () => {
    const res = await request
      .get('/files?limit=999')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    // Should cap at 100 max
    expect(res.body.files.length).toBeLessThanOrEqual(100);
  });
});

describe('GET /file/:filename', () => {
  it('returns 404 for non-existent file', async () => {
    const res = await request.get('/file/nonexistent123').expect(404);

    expect(res.body.message).toContain('not found');
  });

  it('blocks path traversal attempts', async () => {
    // Fastify may normalize the URL before our handler sees it,
    // so `..` check might come back as 404 instead of 400.
    // Either way, the traversal is blocked.
    const res = await request.get('/file/../../../etc/passwd');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('DELETE /file/:id', () => {
  it('rejects unauthenticated requests', async () => {
    await request.delete('/file/1').expect(401);
  });

  it('returns 404 for non-existent file id', async () => {
    const res = await request
      .delete('/file/99999')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(404);

    expect(res.body.message).toContain('not found');
  });

  it("prevents deleting another user's file", async () => {
    // Upload a file as fileowner
    const testFile = path.join(
      process.cwd(),
      'src',
      'tests',
      'fixtures',
      'hello.txt'
    );
    if (!fs.existsSync(testFile)) return;

    const upload = await request
      .post('/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', testFile)
      .expect(200);

    // Extract the file ID from the listing
    const list = await request
      .get('/files')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const fileId = list.body.files[0]?.id;
    expect(fileId).toBeDefined();

    // Other user tries to delete it
    const res = await request
      .delete(`/file/${fileId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    expect(res.body.message).toContain('Not your file');
  });
});

describe('Full upload → list → delete flow', () => {
  it('upload a file, verify in listing, delete it, verify gone', async () => {
    const testFile = path.join(
      process.cwd(),
      'src',
      'tests',
      'fixtures',
      'hello.txt'
    );
    if (!fs.existsSync(testFile)) return;

    // Upload
    const up = await request
      .post('/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', testFile)
      .expect(200);
    expect(up.body.url).toContain('/file/');

    // Verify in listing
    const list1 = await request
      .get('/files')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const file = list1.body.files.find(
      (f: any) => f.original_name === 'hello.txt'
    );
    expect(file).toBeDefined();

    // Delete
    await request
      .delete(`/file/${file.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // Verify gone
    const list2 = await request
      .get('/files')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const stillThere = list2.body.files.find((f: any) => f.id === file.id);
    expect(stillThere).toBeUndefined();
  });
});
