import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '@/app.js';
import { closeDb } from '@/db/index.js';
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

describe('POST /auth/register', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'testuser', password: 'testpass123' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ username: 'testuser' });
    expect(typeof res.body.user.id).toBe('number');
  });

  it('rejects short usernames', async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'ab', password: 'testpass123' })
      .expect(400);

    expect(res.body.details).toMatch(/username.*3|fewer.*3/);
  });

  it('rejects short passwords', async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'validuser', password: '12345' })
      .expect(400);

    expect(res.body.details).toMatch(/password.*6|fewer.*6/);
  });

  it('rejects missing fields', async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'someone' })
      .expect(400);

    expect(res.body.details).toContain('required');
  });

  it('rejects duplicate usernames', async () => {
    await request
      .post('/auth/register')
      .send({ username: 'dupe', password: 'testpass123' })
      .expect(200);

    const res = await request
      .post('/auth/register')
      .send({ username: 'dupe', password: 'testpass123' })
      .expect(409);

    expect(res.body.message).toContain('already taken');
  });
});

describe('POST /auth/login', () => {
  beforeAll(async () => {
    await request
      .post('/auth/register')
      .send({ username: 'loginuser', password: 'loginpass123' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request
      .post('/auth/login')
      .send({ username: 'loginuser', password: 'loginpass123' })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toBe('loginuser');
  });

  it('rejects wrong password', async () => {
    const res = await request
      .post('/auth/login')
      .send({ username: 'loginuser', password: 'wrongpass' })
      .expect(401);

    expect(res.body.message).toContain('Invalid credentials');
  });

  it('rejects non-existent user', async () => {
    const res = await request
      .post('/auth/login')
      .send({ username: 'nobody', password: 'whatever123' })
      .expect(401);

    expect(res.body.message).toContain('Invalid credentials');
  });

  it('rejects missing fields', async () => {
    const res = await request.post('/auth/login').send({}).expect(400);

    expect(res.body.details).toContain('required');
  });
});

describe('GET /auth/me', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'metester', password: 'metest123' });
    token = res.body.token;
  });

  it('returns the current user with a valid token', async () => {
    const res = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.user.username).toBe('metester');
  });

  it('rejects missing token', async () => {
    const res = await request.get('/auth/me').expect(401);

    expect(res.body.message).toContain('Missing token');
  });

  it('rejects invalid token', async () => {
    const res = await request
      .get('/auth/me')
      .set('Authorization', 'Bearer garbage-token')
      .expect(401);

    expect(res.body.message).toContain('Invalid');
  });
});

describe('POST /auth/change-password', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'pwchanger', password: 'oldpass123' });
    token = res.body.token;
  });

  it('changes password with correct current password', async () => {
    const res = await request
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpass123', newPassword: 'newpass456' })
      .expect(200);
    expect(res.body.ok).toBe(true);

    // Old password should no longer work for login
    const loginOld = await request
      .post('/auth/login')
      .send({ username: 'pwchanger', password: 'oldpass123' });
    expect(loginOld.status).toBe(401);

    // New password should work
    const loginNew = await request
      .post('/auth/login')
      .send({ username: 'pwchanger', password: 'newpass456' });
    expect(loginNew.status).toBe(200);
  });

  it('rejects wrong current password', async () => {
    // Re-register fresh user (token from beforeAll got invalidated by password change)
    const r = await request
      .post('/auth/register')
      .send({ username: 'pwchanger2', password: 'correct123' });
    const tok = r.body.token;

    const res = await request
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${tok}`)
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass456' })
      .expect(401);
    expect(res.body.message).toContain('incorrect');
  });

  it('rejects short new password', async () => {
    const res = await request
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'newpass456', newPassword: '12345' })
      .expect(400);
    expect(res.body.details).toMatch(/password.*6|fewer.*6/);
  });
});

describe('GET /auth/storage', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request
      .post('/auth/register')
      .send({ username: 'storageguy', password: 'testpass123' });
    token = res.body.token;
  });

  it('returns storage info for authenticated user', async () => {
    const res = await request
      .get('/auth/storage')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveProperty('used');
    expect(res.body).toHaveProperty('limit');
    expect(typeof res.body.used).toBe('number');
    expect(typeof res.body.limit).toBe('number');
    // Default limit is 10GB
    expect(res.body.limit).toBe(10737418240);
    // New user has 0 used
    expect(res.body.used).toBe(0);
  });

  it('rejects unauthenticated', async () => {
    await request.get('/auth/storage').expect(401);
  });
});

describe('Admin access control', () => {
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const u = await request
      .post('/auth/register')
      .send({ username: 'regularjoe', password: 'testpass123' });
    userToken = u.body.token;

    const a = await request
      .post('/auth/register')
      .send({ username: 'adminjane', password: 'testpass123' });
    adminToken = a.body.token;

    // Make adminjane an admin via DB directly
    const { db } = await import('@/db/index.js');
    await new Promise<void>((resolve) => {
      db.run(
        `UPDATE users SET is_admin = 1 WHERE username = ?`,
        ['adminjane'],
        () => resolve()
      );
    });
    // Re-login to get admin token
    const relogin = await request
      .post('/auth/login')
      .send({ username: 'adminjane', password: 'testpass123' });
    adminToken = relogin.body.token;
  });

  it('regular user cannot access admin routes', async () => {
    await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('admin user can access admin routes', async () => {
    await request
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('/auth/me returns isAdmin for admin user', async () => {
    const res = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.user.isAdmin).toBe(true);
  });

  it('/auth/me returns isAdmin false for regular user', async () => {
    const res = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(res.body.user.isAdmin).toBe(false);
  });
});

describe('Login lockout', () => {
  let token: string;

  beforeAll(async () => {
    const r = await request
      .post('/auth/register')
      .send({ username: 'lockouttest', password: 'correct123' });
    token = r.body.token;
  });

  it('locks account after too many failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request
        .post('/auth/login')
        .send({ username: 'lockouttest', password: 'wrongpass' });
      if (i < 4) {
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('attempt');
      } else {
        expect(res.body.message).toContain('locked');
      }
    }
  });

  it('rejects correct password while locked', async () => {
    const res = await request
      .post('/auth/login')
      .send({ username: 'lockouttest', password: 'correct123' });
    // 401 from lockout or 429 from rate limit
    expect(res.status).toBeGreaterThanOrEqual(401);
  });

  it('unlocks after resetting via admin unlock endpoint', async () => {
    // Create an admin user within this test's app instance
    const adminReg = await request
      .post('/auth/register')
      .send({ username: 'adminjane', password: 'testpass123' });
    const adminTok = adminReg.body.token;

    // Promote to admin via DB (since only existing admin can promote)
    const { db } = await import('@/db/index.js');
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE users SET is_admin = 1 WHERE username = ?`,
        ['adminjane'],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    // Re-login to get a token with admin privileges
    const adminLogin = await request
      .post('/auth/login')
      .send({ username: 'adminjane', password: 'testpass123' });
    const freshAdminTok = adminLogin.body.token;

    // Find the user ID by listing admin users
    const usersRes = await request
      .get('/admin/users?search=lockouttest')
      .set('Authorization', `Bearer ${freshAdminTok}`)
      .expect(200);
    const lockoutUser = usersRes.body.users.find(
      (u: any) => u.username === 'lockouttest'
    );
    const userId = lockoutUser?.id;

    // Reset the lock via the unlock endpoint
    await request
      .post(`/admin/users/${userId}/unlock`)
      .set('Authorization', `Bearer ${freshAdminTok}`)
      .expect(200);

    // Now should be able to login
    const res = await request
      .post('/auth/login')
      .send({ username: 'lockouttest', password: 'correct123' });
    expect(res.status).toBe(200);
  });
});

describe('GET /health', () => {
  it('returns ok with uptime', async () => {
    const res = await request.get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('POST /auth/demo', () => {
  it('creates a demo account and returns token', async () => {
    const res = await request
      .post('/auth/demo')
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('username');
    expect(res.body.user.isDemo).toBe(true);
    expect(res.body.user.isAdmin).toBe(false);
  });

  it('creates unique demo usernames each time', async () => {
    const a = await request.post('/auth/demo').expect(200);
    const b = await request.post('/auth/demo').expect(200);

    expect(a.body.user.username).not.toBe(b.body.user.username);
  });
});

describe('POST /auth/demo-session', () => {
  let demoToken: string;

  beforeAll(async () => {
    const r = await request.post('/auth/demo').expect(200);
    demoToken = r.body.token;
  });

  it('ends demo session and deletes the user', async () => {
    const res = await request
      .post('/auth/demo-session')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
  });

  it('rejects ending session for non-demo user', async () => {
    const reg = await request
      .post('/auth/register')
      .send({ username: 'notademo', password: 'testpass123' });
    const regularToken = reg.body.token;

    await request
      .post('/auth/demo-session')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);
  });
});
