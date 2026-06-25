import { describe, it, expect } from 'vitest';
import { request, adminToken } from '../setup/setup.js';

describe('GET /admin/storage', () => {
  it('returns storage configuration', async () => {
    const res = await request
      .get('/admin/storage')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('backend');
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('total_files');
    expect(res.body).toHaveProperty('total_bytes');
    expect(res.body).toHaveProperty('registrations_open');
  });
});

describe('PATCH /admin/storage', () => {
  it('updates storage settings', async () => {
    const res = await request
      .patch('/admin/storage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ registrations_open: 'false' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.updated).toContain('registrations_open');
  });

  it('rejects empty update', async () => {
    await request
      .patch('/admin/storage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('updates global max_file_size', async () => {
    const res = await request
      .patch('/admin/storage')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ max_file_size: '104857600' })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.updated).toContain('max_file_size');
  });

  it('returns max_file_size in GET response', async () => {
    const res = await request
      .get('/admin/storage')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('max_file_size');
    expect(res.body.max_file_size).toBe(104857600);
  });
});

describe('GET /admin/analytics', () => {
  it('returns analytics data', async () => {
    const res = await request
      .get('/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('total_files');
    expect(res.body).toHaveProperty('total_bytes');
    expect(res.body).toHaveProperty('uploads_today');
  });
});

describe('GET /admin/ssl', () => {
  it('returns SSL status', async () => {
    const res = await request
      .get('/admin/ssl')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('domain');
    expect(res.body).toHaveProperty('is_local');
    expect(res.body).toHaveProperty('managed_by');
  });
});
