import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { request, adminToken, userToken } from '../setup/setup.js';

describe('POST /admin/backup/run', () => {
  it('triggers a backup and returns results', async () => {
    const res = await request
      .post('/admin/backup/run')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('ok');
    expect(res.body).toHaveProperty('results');
  });

  it('rejects non-admin', async () => {
    await request
      .post('/admin/backup/run')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

describe('GET /admin/backup/history', () => {
  it('returns backup history', async () => {
    const res = await request
      .get('/admin/backup/history')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('backups');
    expect(Array.isArray(res.body.backups)).toBe(true);
  });
});

describe('GET /admin/backup/latest', () => {
  it('returns latest backup or 404', async () => {
    const res = await request
      .get('/admin/backup/latest')
      .set('Authorization', `Bearer ${adminToken}`);

    expect([200, 404]).toContain(res.status);
  });
});

describe('GET /admin/backup/list', () => {
  it('returns backup file list', async () => {
    const res = await request
      .get('/admin/backup/list')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('backups');
  });
});

describe('POST /admin/backup/upload', () => {
  it('rejects non-db files', async () => {
    const tmpFile = '/tmp/test-not-db.txt';
    fs.writeFileSync(tmpFile, 'not a database');

    const res = await request
      .post('/admin/backup/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', tmpFile)
      .expect(400);

    expect(res.body.message).toMatch(/Only .db files/);
    fs.unlinkSync(tmpFile);
  });
});

describe('DELETE /admin/backup/delete', () => {
  it('rejects invalid filename', async () => {
    await request
      .delete('/admin/backup/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ filename: '../etc/passwd' })
      .expect(400);
  });

  it('returns 404 for non-existent backup', async () => {
    await request
      .delete('/admin/backup/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ filename: 'database-2099-01-01-nonexistent.db' })
      .expect(404);
  });
});

describe('GET /admin/backup/schedule', () => {
  it('returns backup schedule hours', async () => {
    const res = await request
      .get('/admin/backup/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('backup_schedule_hours');
    expect(typeof res.body.backup_schedule_hours).toBe('number');
    expect(res.body.backup_schedule_hours).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-admin', async () => {
    await request
      .get('/admin/backup/schedule')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

describe('PATCH /admin/backup/schedule', () => {
  it('updates backup schedule hours', async () => {
    const res = await request
      .patch('/admin/backup/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup_schedule_hours: 12 })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.backup_schedule_hours).toBe(12);
  });

  it('rejects invalid value (too low)', async () => {
    await request
      .patch('/admin/backup/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup_schedule_hours: 0 })
      .expect(400);
  });

  it('rejects invalid value (too high)', async () => {
    await request
      .patch('/admin/backup/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup_schedule_hours: 1000 })
      .expect(400);
  });

  it('rejects non-admin', async () => {
    await request
      .patch('/admin/backup/schedule')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ backup_schedule_hours: 12 })
      .expect(403);
  });

  it('restores default schedule', async () => {
    const res = await request
      .patch('/admin/backup/schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ backup_schedule_hours: 6 })
      .expect(200);

    expect(res.body.backup_schedule_hours).toBe(6);
  });
});
