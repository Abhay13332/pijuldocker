// tests/auth.test.js
const request = require('supertest');
const app = require('../app'); // your Express app
const { pool, initDatabase } = require('../db'); // your database module
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Environment: use test database
process.env.POSTGRES_DB = 'pijulDB_test';
process.env.JWT_SECRET = 'test-secret-key';

describe('Authentication API', () => {
  beforeAll(async () => {
    // Initialize tables in test database
    await initDatabase();
  });

  beforeEach(async () => {
    // Clean all tables before each test (to avoid duplicate usernames)
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users');
      await client.query('DELETE FROM ssh_keys'); // cascade will handle but explicit is fine
      await client.query('DELETE FROM repositories');
      await client.query('DELETE FROM collaborators');
      await client.query('DELETE FROM discussions');
      await client.query('DELETE FROM comments');
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Close database pool after all tests
    await pool.end();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid username and password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'alice', password: 'secret123' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('username', 'alice');
      expect(res.body).toHaveProperty('token'); // token returned in body
      
      // Check cookie was set
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader[0]).toMatch(/token=.+; HttpOnly; SameSite=Strict/);
      
      // Verify user exists in DB
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', ['alice']);
      expect(rows.length).toBe(1);
      expect(rows[0].username).toBe('alice');
      // Password should be hashed
      expect(rows[0].password).not.toBe('secret123');
      const valid = await bcrypt.compare('secret123', rows[0].password);
      expect(valid).toBe(true);
    });

    it('should return 400 when username already exists', async () => {
      // First create a user
      await pool.query(
        'INSERT INTO users (id, username, password) VALUES ($1, $2, $3)',
        ['123e4567-e89b-12d3-a456-426614174000', 'bob', await bcrypt.hash('pass', 10)]
      );
      
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'bob', password: 'newpass' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      // The error message depends on your users.create implementation; adjust accordingly
      expect(res.body.error).toBeDefined();
      
      // Ensure only one user exists
      const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', ['bob']);
      expect(rows.length).toBe(1);
    });

    it('should return 400 for missing username or password', async () => {
      let res = await request(app).post('/api/auth/register').send({ username: 'alice' });
      expect(res.statusCode).toBe(400);
      
      res = await request(app).post('/api/auth/register').send({ password: 'secret' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      const hashed = await bcrypt.hash('correctpass', 10);
      await pool.query(
        'INSERT INTO users (id, username, password) VALUES ($1, $2, $3)',
        ['123e4567-e89b-12d3-a456-426614174001', 'charlie', hashed]
      );
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'charlie', password: 'correctpass' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('username', 'charlie');
      expect(res.body).not.toHaveProperty('token'); // token not in body for login (only cookie)
      
      // Check cookie
      const cookieHeader = res.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader[0]).toMatch(/token=.+; HttpOnly; SameSite=Strict/);
      
      // Verify token contents
      const tokenMatch = cookieHeader[0].match(/token=([^;]+)/);
      const token = tokenMatch[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('username', 'charlie');
    });

    it('should return 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'charlie', password: 'wrongpass' });
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
      // No cookie should be set
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('should return 401 for non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'any' });
      
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 400 for missing fields', async () => {
      let res = await request(app).post('/api/auth/login').send({ username: 'charlie' });
      expect(res.statusCode).toBe(400);
      
      res = await request(app).post('/api/auth/login').send({ password: 'pass' });
      expect(res.statusCode).toBe(400);
    });
  });


describe('GET /api/user/profile', () => {
  let authCookie; // store cookie from login
  let testUsername = 'dave';
  let testPassword = 'secure123';

  beforeEach(async () => {
    // Clean and create a fresh user for each profile test
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users WHERE username = $1', [testUsername]);
      await client.query('DELETE FROM ssh_keys'); // clean all keys
    } finally {
      client.release();
    }

    // Register the user via API to ensure consistent cookie handling
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUsername, password: testPassword });
    expect(registerRes.statusCode).toBe(200);
    // Extract cookie from register response
    authCookie = registerRes.headers['set-cookie'];
  });

  it('should return 401 if no token cookie provided', async () => {
    const res = await request(app).get('/api/user/profile');
    expect(res.statusCode).toBe(401);
    // Adjust error message based on your authenticateToken implementation
    expect(res.body).toHaveProperty('error', 'Unauthorized');
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app)
      .get('/api/user/profile')
      .set('Cookie', ['token=invalid.token.here']);
    expect(res.statusCode).toBe(401);
  });

  it('should return user profile without password and with sshKeys array when authenticated', async () => {
    const res = await request(app)
      .get('/api/user/profile')
      .set('Cookie', authCookie);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('username', testUsername);
    expect(res.body).toHaveProperty('created_at');
    expect(res.body).toHaveProperty('sshKeys');
    expect(Array.isArray(res.body.sshKeys)).toBe(true);
    // Password must not be present
    expect(res.body).not.toHaveProperty('password');
  });

  it('should include SSH keys if user has any', async () => {
    // First, add an SSH key for the user using the database directly
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [testUsername]);
    const userId = userResult.rows[0].id;
    await pool.query(
      `INSERT INTO ssh_keys (id, user_id, name, key) 
       VALUES ($1, $2, $3, $4)`,
      ['key-uuid-1', userId, 'my-key', 'ssh-rsa AAAAB3...']
    );

    const res = await request(app)
      .get('/api/user/profile')
      .set('Cookie', authCookie);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.sshKeys).toHaveLength(1);
    expect(res.body.sshKeys[0]).toMatchObject({
      id: 'key-uuid-1',
      name: 'my-key',
      key: 'ssh-rsa AAAAB3...',
      user_id: userId,
      created_at: expect.any(String)
    });
    // Should not contain password
    expect(res.body).not.toHaveProperty('password');
  });

  it('should return empty sshKeys array if user has no keys', async () => {
    // Ensure no keys exist for this user (already cleaned in beforeEach)
    const res = await request(app)
      .get('/api/user/profile')
      .set('Cookie', authCookie);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.sshKeys).toEqual([]);
  });
});
});
