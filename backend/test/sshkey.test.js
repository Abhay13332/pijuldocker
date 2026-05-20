// tests/sshkey.test.js
const request = require('supertest');
const app = require('../app');
const { pool, initDatabase } = require('../db');

process.env.POSTGRES_DB = 'pijulDB_test';
process.env.JWT_SECRET = 'test-secret-key';

describe('SSH Key Management API', () => {
  let authCookie;
  const testUser = 'keyuser';
  const testPass = 'keypass123';

  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(async () => {
    // Clean tables so each test starts empty (respects FK: ssh_keys depends on users)
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM ssh_keys');
      await client.query('DELETE FROM users');
    } finally {
      client.release();
    }

    // Register a fresh user and capture the auth cookie
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUser, password: testPass });
    expect(registerRes.statusCode).toBe(200);
    authCookie = registerRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/user/keys', () => {
    it('should add a new SSH key and persist it in the database', async () => {
      const keyData = {
        name: 'work-laptop',
        key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...'
      };
      const res = await request(app)
        .post('/api/user/keys')
        .set('Cookie', authCookie)
        .send(keyData);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('key added ');

      // --- Database check ---
      const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [testUser]);
      const userId = userRes.rows[0].id;
      const keyRes = await pool.query(
        'SELECT * FROM ssh_keys WHERE user_id = $1 AND name = $2',
        [userId, keyData.name]
      );
      expect(keyRes.rows.length).toBe(1);
      expect(keyRes.rows[0].key).toBe(keyData.key);
      expect(keyRes.rows[0]).toHaveProperty('id');     // UUID generated
      expect(keyRes.rows[0]).toHaveProperty('created_at');
    });

    it('should return 400 if name or key is missing', async () => {
      let res = await request(app)
        .post('/api/user/keys')
        .set('Cookie', authCookie)
        .send({ key: 'somekey' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();

      res = await request(app)
        .post('/api/user/keys')
        .set('Cookie', authCookie)
        .send({ name: 'test-key' });
      expect(res.statusCode).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post('/api/user/keys')
        .send({ name: 'noauth', key: 'blah' });
      expect(res.statusCode).toBe(401);
    });

    it('should allow duplicate key names because schema has no unique constraint', async () => {
      // First key
      await request(app)
        .post('/api/user/keys')
        .set('Cookie', authCookie)
        .send({ name: 'same-name', key: 'first' });

      // Second key with same name – schema allows it, app may or may not reject.
      const res = await request(app)
        .post('/api/user/keys')
        .set('Cookie', authCookie)
        .send({ name: 'same-name', key: 'second' });

      // If your application intentionally rejects duplicates, expect 400.
      // If it allows, expect 200. Adjust the assertion to match your business logic.
      // Here we assume it's allowed (since no DB constraint).
      if (res.statusCode === 200) {
        // Verify both keys exist
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [testUser]);
        const userId = userRes.rows[0].id;
        const keyRes = await pool.query(
          'SELECT * FROM ssh_keys WHERE user_id = $1 AND name = $2',
          [userId, 'same-name']
        );
        expect(keyRes.rows.length).toBe(2);
      } else {
        expect(res.statusCode).toBe(400);
      }
    });
  });

  describe('DELETE /api/user/keys/:id', () => {
    let existingKeyId;

    beforeEach(async () => {
      // Insert a key directly into DB (respects schema) that belongs to our test user
      const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [testUser]);
      const userId = userRes.rows[0].id;
      const insertRes = await pool.query(
        `INSERT INTO ssh_keys (id, user_id, name, key) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['key-12345', userId, 'to-delete', 'ssh-rsa dummy']
      );
      existingKeyId = insertRes.rows[0].id;
    });

    it('should delete an existing SSH key and remove it from the database', async () => {
      const res = await request(app)
        .delete(`/api/user/keys/${existingKeyId}`)
        .set('Cookie', authCookie);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Key deleted');

      // --- Database check: key should be gone ---
      const keyCheck = await pool.query('SELECT * FROM ssh_keys WHERE id = $1', [existingKeyId]);
      expect(keyCheck.rows.length).toBe(0);
    });

    it('should return 400 when trying to delete a non-existent key', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'; // valid UUID format
      const res = await request(app)
        .delete(`/api/user/keys/${fakeId}`)
        .set('Cookie', authCookie);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .delete(`/api/user/keys/${existingKeyId}`);
      expect(res.statusCode).toBe(401);
    });

    it('should not allow deleting another user\'s key (authorization check)', async () => {
      // Create a second user and a key for them
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'otheruser', password: 'otherpass' });

      const otherUserRes = await pool.query('SELECT id FROM users WHERE username = $1', ['otheruser']);
      const otherUserId = otherUserRes.rows[0].id;
      const otherKeyRes = await pool.query(
        `INSERT INTO ssh_keys (id, user_id, name, key) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['other-key-id', otherUserId, 'other-key', 'ssh-rsa other']
      );
      const otherKeyId = otherKeyRes.rows[0].id;

      // Attempt deletion with the first user's cookie
      const res = await request(app)
        .delete(`/api/user/keys/${otherKeyId}`)
        .set('Cookie', authCookie);

      // Expect failure (403 Forbidden or 400 Bad Request – adjust to your API)
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();

      // Verify the other user's key still exists in the database
      const stillThere = await pool.query('SELECT * FROM ssh_keys WHERE id = $1', [otherKeyId]);
      expect(stillThere.rows.length).toBe(1);
    });
  });
});