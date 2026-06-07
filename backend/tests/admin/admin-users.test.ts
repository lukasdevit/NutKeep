import { describe, it, expect } from 'vitest';
import { request, adminToken, userToken, userId } from '../setup/setup.js';

describe('GET /admin/users', () => {
  it('returns list of users with stats', async () => {
    const res = await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');

    const victim = res.body.users.find(
      (u: any) => u.username === 'regular-user'
    );
    expect(victim).toBeDefined();
    expect(victim).toHaveProperty('file_count');
    expect(victim).toHaveProperty('used');
  });

  it('rejects non-admin', async () => {
    await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

describe('POST /admin/users (create)', () => {
  it('creates a new user', async () => {
    const res = await request
      .post('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'createdbyadmin', password: 'adminmade123' })
      .expect(200);

    expect(res.body).toHaveProperty('id');
    expect(res.body.username).toBe('createdbyadmin');
  });

  it('rejects duplicate username', async () => {
    await request
      .post('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'createdbyadmin', password: 'testpass123' })
      .expect(409);
  });
});

describe('PATCH /admin/users/:id', () => {
  it('updates storage limit', async () => {
    await request
      .patch(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ storage_limit: 5368709120 })
      .expect(200);

    const list = await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const u = list.body.users.find((u: any) => u.id === userId);
    expect(u.storage_limit).toBe(5368709120);
  });

  it('toggles admin status', async () => {
    await request
      .patch(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_admin: true })
      .expect(200);

    const list = await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const u = list.body.users.find((u: any) => u.id === userId);
    expect(u.is_admin).toBe(1);
  });

  it('resets user password', async () => {
    await request
      .patch(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'resetpass999' })
      .expect(200);

    const login = await request
      .post('/auth/login')
      .send({ username: 'regular-user', password: 'resetpass999' });
    expect(login.status).toBe(200);
  });

  it('rejects invalid storage limit', async () => {
    const res = await request
      .patch(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ storage_limit: -1 })
      .expect(400);
    expect(res.body.details).toMatch(/0|negative/);
  });
});

describe('DELETE /admin/users/:id', () => {
  it('prevents admin from deleting themselves', async () => {
    const me = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    const myId = me.body.user.id;

    const res = await request
      .delete(`/admin/users/${myId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(res.body.message).toContain('delete yourself');
  });

  it('deletes a user', async () => {
    const r = await request
      .post('/auth/register')
      .send({ username: 'disposable2', password: 'testpass123' });
    const dispId = r.body.user.id;

    const res = await request
      .delete(`/admin/users/${dispId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);

    const list = await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.users.find((u: any) => u.id === dispId)).toBeUndefined();
  });
});

describe('POST /admin/users/:id/unlock', () => {
  it('unlocks a user', async () => {
    const res = await request
      .post(`/admin/users/${userId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('GET /admin/users/demo-config', () => {
  it('returns demo registrations are open by default', async () => {
    const res = await request
      .get('/admin/users/demo-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.demo_registrations_open).toBe(true);
  });

  it('rejects non-admin', async () => {
    await request
      .get('/admin/users/demo-config')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

describe('PATCH /admin/users/demo-config', () => {
  it('disables demo registrations', async () => {
    const res = await request
      .patch('/admin/users/demo-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ demo_registrations_open: false })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.demo_registrations_open).toBe(false);
  });

  it('re-enables demo registrations', async () => {
    const res = await request
      .patch('/admin/users/demo-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ demo_registrations_open: true })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.demo_registrations_open).toBe(true);
  });

  it('rejects non-boolean value', async () => {
    await request
      .patch('/admin/users/demo-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ demo_registrations_open: 'yes' })
      .expect(400);
  });

  it('rejects non-admin', async () => {
    await request
      .patch('/admin/users/demo-config')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ demo_registrations_open: false })
      .expect(403);
  });
});
