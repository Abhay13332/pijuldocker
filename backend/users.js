const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '../data/users.json');

if (!fs.existsSync(path.dirname(USERS_FILE))) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
}

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

const users = {
    getAll() {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    },

    saveAll(data) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
    },

    findByUsername(username) {
        return this.getAll().find(u => u.username === username);
    },

    create(username, password) {
        const data = this.getAll();
        if (data.find(u => u.username === username)) throw new Error('User already exists');
        
        // In a real app, hash the password!
        const newUser = { 
            id: crypto.randomUUID(), 
            username, 
            password, 
            sshKeys: [] 
        };
        data.push(newUser);
        this.saveAll(data);
        return newUser;
    },

    addSshKey(username, keyName, publicKey) {
        const data = this.getAll();
        const user = data.find(u => u.username === username);
        if (!user) throw new Error('User not found');
        
        user.sshKeys.push({ id: crypto.randomUUID(), name: keyName, key: publicKey });
        this.saveAll(data);
        return user;
    },

    removeSshKey(username, keyId) {
        const data = this.getAll();
        const user = data.find(u => u.username === username);
        if (!user) throw new Error('User not found');
        
        user.sshKeys = user.sshKeys.filter(k => k.id !== keyId);
        this.saveAll(data);
        return user;
    }
};

module.exports = users;
