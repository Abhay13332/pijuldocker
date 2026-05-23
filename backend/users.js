const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {pool}=require('./db')
const bcrypt = require('bcrypt');
const USERS_FILE = path.join(__dirname, '../data/users.json');

if (!fs.existsSync(path.dirname(USERS_FILE))) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

const users = {
   

    async findByUsername(username) {
        const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
    );
    return result.rows[0] || null;
    },

   async create(username, password,gitEncryptedToken) {
       const existingUser = await pool.query(
        'SELECT username FROM users WHERE username = $1',
        [username]
      );
       if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
       }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const userId = crypto.randomUUID();
    
    // Insert user into database
    await pool.query(
        'INSERT INTO users (id, username, password) VALUES ($1, $2, $3)',
        [userId, username, hashedPassword]
    );
    
    return {
        id: userId,
        username: username,
        password: hashedPassword,
        sshKeys: []
    };

    },

    async addSshKey(username, keyName, publicKey) {
    // First, get the user
    const userResult = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );
    
    if (userResult.rows.length === 0) {
        throw new Error('User not found');
    }
    
    const userId = userResult.rows[0].id;
    const keyId = crypto.randomUUID();
    
    // Insert the SSH key
    await pool.query(
        `INSERT INTO ssh_keys (id, user_id, name, key, created_at) 
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [keyId, userId, keyName, publicKey]
    );
    
   
},

   async removeSshKey(username, keyId) {
    // First, get the user
    const userResult = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );
    
    if (userResult.rows.length === 0) {
        throw new Error('User not found');
    }
    
    const userId = userResult.rows[0].id;
    
    // Check if the SSH key exists and belongs to this user
    const keyResult = await pool.query(
        'SELECT id FROM ssh_keys WHERE id = $1 AND user_id = $2',
        [keyId, userId]
    );
    
    if (keyResult.rows.length === 0) {
        throw new Error('SSH key not found or does not belong to this user');
    }
    
    // Delete the SSH key
    await pool.query(
        'DELETE FROM ssh_keys WHERE id = $1 AND user_id = $2',
        [keyId, userId]
    );
    
    
    },
   async getsshkeys(username) {
    // First, get the user
    const userResult = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );
    
    if (userResult.rows.length === 0) {
        throw new Error('User not found');
    }
    
    const userId = userResult.rows[0].id;
    
    // Get all SSH keys for this user
    const keysResult = await pool.query(
        'SELECT id, name, key, created_at FROM ssh_keys WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    
    return keysResult.rows.map(key => ({
        id: key.id,
        name: key.name,
        key: key.key,
        createdAt: key.created_at
    }));
}
};

module.exports = users;
